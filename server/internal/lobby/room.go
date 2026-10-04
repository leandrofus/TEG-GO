package lobby

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sort"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"teg-server/internal/bot"
	"teg-server/internal/game"
	"teg-server/internal/store"
)

const (
	StatusWaiting  = "waiting"
	StatusPicking  = "picking" // sorteados los turnos, eligiendo colores
	StatusPlaying  = "playing"
	StatusFinished = "finished"
)

// Seat es un lugar en la sala: un color ocupado por una cuenta, un invitado o
// un bot. Se guarda tal cual en la base (incluido el token del invitado, para
// que pueda volver a su lugar si recarga la página).
type Seat struct {
	Color      game.Color `json:"color"`
	Name       string     `json:"name"`
	UserID     int64      `json:"userId,omitempty"`
	GuestToken string     `json:"guestToken,omitempty"`
	IsBot      bool       `json:"isBot"`
	IsHost     bool       `json:"isHost"`

	// Sorteo de turnos: puesto (1 = empieza), dados tirados (con desempates)
	// y si ya eligió color. Mientras no eligió, Color es provisorio.
	Order  int   `json:"order,omitempty"`
	Rolls  []int `json:"rolls,omitempty"`
	Picked bool  `json:"picked,omitempty"`

	conn *Conn
}

func (s *Seat) belongsTo(id Identity) bool {
	if s.IsBot {
		return false
	}
	if id.UserID > 0 {
		return s.UserID == id.UserID
	}
	return s.GuestToken != "" && s.GuestToken == id.Token
}

type Room struct {
	Code         string
	Name         string
	MaxPlayers   int
	CreatedAt    time.Time
	passwordHash string

	Seats      []*Seat
	spectators map[*Conn]bool
	Board      *game.GameBoard

	Mu      sync.Mutex
	manager *Manager
	closed  bool
	botLoop bool
	// Los bots esperan a que se vea el sorteo antes de elegir color
	botPickAt time.Time
}

func (r *Room) Private() bool { return r.passwordHash != "" }

func (r *Room) checkPassword(pw string) bool {
	return r.passwordHash == "" || bcrypt.CompareHashAndPassword([]byte(r.passwordHash), []byte(pw)) == nil
}

func (r *Room) status() string {
	switch {
	case r.picking():
		return StatusPicking
	case r.Board == nil:
		return StatusWaiting
	case r.Board.CurrentPhase == game.PhaseFinished:
		return StatusFinished
	default:
		return StatusPlaying
	}
}

// waitingFor lista a los jugadores humanos desconectados que pausan la partida.
func (r *Room) waitingFor() []string {
	if r.status() != StatusPlaying {
		return nil
	}
	var names []string
	for _, s := range r.Seats {
		if s.IsBot || s.conn != nil {
			continue
		}
		if p := r.Board.Players[s.Color]; p != nil && !p.IsAlive {
			continue // un eliminado no frena la partida
		}
		names = append(names, s.Name)
	}
	return names
}

// picking dice si ya se sortearon los turnos y se están eligiendo colores.
func (r *Room) picking() bool {
	if r.Board != nil {
		return false
	}
	for _, s := range r.Seats {
		if s.Order > 0 {
			return true
		}
	}
	return false
}

// started dice si ya no se puede entrar a jugar ni cambiar los lugares.
func (r *Room) started() bool { return r.Board != nil || r.picking() }

// nextPicker es el próximo en elegir color, según el sorteo.
func (r *Room) nextPicker() *Seat {
	var next *Seat
	for _, s := range r.Seats {
		if s.Order > 0 && !s.Picked && (next == nil || s.Order < next.Order) {
			next = s
		}
	}
	return next
}

func (r *Room) seatOf(c *Conn) *Seat {
	for _, s := range r.Seats {
		if s.conn == c {
			return s
		}
	}
	return nil
}

func (r *Room) seatByColor(color game.Color) *Seat {
	for _, s := range r.Seats {
		if s.Color == color {
			return s
		}
	}
	return nil
}

func (r *Room) host() *Seat {
	for _, s := range r.Seats {
		if s.IsHost {
			return s
		}
	}
	return nil
}

// passHost le da el rol de anfitrión al primer humano que quede.
func (r *Room) passHost() {
	for _, s := range r.Seats {
		s.IsHost = false
	}
	for _, s := range r.Seats {
		if !s.IsBot {
			s.IsHost = true
			return
		}
	}
}

func (r *Room) humans() int {
	n := 0
	for _, s := range r.Seats {
		if !s.IsBot {
			n++
		}
	}
	return n
}

func (r *Room) freeColor() game.Color {
	used := map[game.Color]bool{}
	for _, s := range r.Seats {
		used[s.Color] = true
	}
	for _, c := range game.AllColors {
		if !used[c] {
			return c
		}
	}
	return ""
}

// ---------------------------------------------------------------------------
// Entrar y salir

// Join sienta a la conexión en la sala, la reconecta a su lugar si ya tenía
// uno, o la suma como espectador.
func (r *Room) Join(c *Conn, password string, spectate bool) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.closed {
		return fmt.Errorf("la sala ya no existe")
	}

	// ¿Ya tiene un lugar? Vuelve a él (aunque la partida esté en curso)
	for _, s := range r.Seats {
		if s.belongsTo(c.Identity) {
			if s.conn != nil && s.conn != c {
				s.conn.SendJSON(map[string]string{"type": "SESSION_REPLACED", "message": "Abriste esta partida en otra ventana."})
			}
			s.conn = c
			delete(r.spectators, c)
			r.changed()
			return nil
		}
	}

	if !r.checkPassword(password) {
		return fmt.Errorf("contraseña incorrecta")
	}

	if spectate {
		r.spectators[c] = true
		r.broadcast()
		return nil
	}
	if r.started() {
		return fmt.Errorf("la partida ya empezó; podés entrar como espectador")
	}
	if len(r.Seats) >= r.MaxPlayers {
		return fmt.Errorf("la sala está llena (máximo %d jugadores)", r.MaxPlayers)
	}

	seat := &Seat{Color: r.freeColor(), Name: c.Identity.Name, conn: c}
	if c.Identity.UserID > 0 {
		seat.UserID = c.Identity.UserID
	} else {
		seat.GuestToken = c.Identity.Token
	}
	seat.IsHost = r.host() == nil
	r.Seats = append(r.Seats, seat)
	r.changed()
	return nil
}

// Leave es la salida voluntaria: en la sala de espera libera el lugar; en una
// partida en curso el lugar pasa a un bot (abandono).
func (r *Room) Leave(c *Conn) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	if r.spectators[c] {
		delete(r.spectators, c)
		r.broadcast()
		return
	}
	seat := r.seatOf(c)
	if seat == nil {
		return
	}

	if !r.started() {
		r.removeSeat(seat)
	} else {
		r.toBot(seat, "abandonó la partida")
	}
	if seat.IsHost {
		r.passHost()
	}
	if r.humans() == 0 && r.status() != StatusPlaying {
		r.close()
		return
	}
	r.changed()
}

// Disconnect se llama cuando se cierra el websocket: el lugar queda reservado
// (y si la partida está en curso, se pausa hasta que vuelva).
func (r *Room) Disconnect(c *Conn) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	if r.spectators[c] {
		delete(r.spectators, c)
		r.broadcast()
		return
	}
	if seat := r.seatOf(c); seat != nil {
		seat.conn = nil
		r.broadcast()
	}
}

func (r *Room) removeSeat(seat *Seat) {
	for i, s := range r.Seats {
		if s == seat {
			r.Seats = append(r.Seats[:i], r.Seats[i+1:]...)
			return
		}
	}
}

// toBot convierte un lugar humano en bot, también dentro del tablero.
func (r *Room) toBot(seat *Seat, reason string) {
	seat.IsBot = true
	seat.UserID = 0
	seat.GuestToken = ""
	seat.conn = nil
	if r.Board != nil {
		if p := r.Board.Players[seat.Color]; p != nil {
			p.IsBot = true
			r.Board.AddLog(fmt.Sprintf("%s %s; lo reemplaza un bot.", seat.Name, reason))
		}
	}
}

// canDelete dice si id puede borrar la sala: tiene que ser el anfitrión y no
// puede quedar ningún otro jugador humano (los bots no cuentan).
func (r *Room) canDelete(id Identity) bool {
	h := r.host()
	return h != nil && h.belongsTo(id) && r.humans() == 1
}

// Delete borra la sala a pedido del anfitrión. A quien siga conectado
// (el anfitrión en otra ventana o los espectadores) se lo saca de la sala.
func (r *Room) Delete(id Identity) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.closed {
		return fmt.Errorf("la sala ya no existe")
	}
	if !r.canDelete(id) {
		return fmt.Errorf("solo el anfitrión puede borrar la sala, y únicamente si no hay otros jugadores")
	}
	msg := map[string]string{"type": "KICKED", "message": "La sala fue borrada."}
	for _, s := range r.Seats {
		if s.conn != nil {
			s.conn.SendJSON(msg)
			s.conn = nil
		}
	}
	for c := range r.spectators {
		c.SendJSON(msg)
		delete(r.spectators, c)
	}
	r.close()
	return nil
}

// ---------------------------------------------------------------------------
// Acciones del anfitrión

func (r *Room) requireHost(c *Conn) error {
	seat := r.seatOf(c)
	if seat == nil || !seat.IsHost {
		return fmt.Errorf("solo el anfitrión puede hacer eso")
	}
	return nil
}

func (r *Room) AddBot(c *Conn) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if err := r.requireHost(c); err != nil {
		return err
	}
	if r.started() || len(r.Seats) >= r.MaxPlayers {
		return fmt.Errorf("no hay lugar para otro bot")
	}
	bots := 0
	for _, s := range r.Seats {
		if s.IsBot {
			bots++
		}
	}
	r.Seats = append(r.Seats, &Seat{Color: r.freeColor(), Name: fmt.Sprintf("Bot General %d", bots+1), IsBot: true})
	r.changed()
	return nil
}

// RemoveSeat saca a un bot o a un jugador de la sala de espera.
func (r *Room) RemoveSeat(c *Conn, color game.Color) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if err := r.requireHost(c); err != nil {
		return err
	}
	if r.started() {
		return fmt.Errorf("la partida ya empezó")
	}
	seat := r.seatByColor(color)
	if seat == nil || seat.IsHost {
		return fmt.Errorf("no se puede quitar ese lugar")
	}
	if seat.conn != nil {
		seat.conn.SendJSON(map[string]string{"type": "KICKED", "message": "El anfitrión te sacó de la sala."})
	}
	r.removeSeat(seat)
	r.changed()
	return nil
}

// ReplaceWithBot deja a un bot en el lugar de un jugador desconectado, para
// destrabar una partida pausada.
func (r *Room) ReplaceWithBot(c *Conn, color game.Color) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if err := r.requireHost(c); err != nil {
		return err
	}
	seat := r.seatByColor(color)
	if !r.started() || seat == nil || seat.IsBot || seat.conn != nil {
		return fmt.Errorf("solo se puede reemplazar a un jugador desconectado")
	}
	r.toBot(seat, "no volvió")
	r.changed()
	return nil
}

// Start sortea el orden de los turnos. Después cada uno elige color en ese
// orden (ver PickColor) y, cuando eligieron todos, empieza la partida.
func (r *Room) Start(c *Conn) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if err := r.requireHost(c); err != nil {
		return err
	}
	if r.started() {
		return fmt.Errorf("la partida ya empezó")
	}
	if len(r.Seats) < 2 {
		return fmt.Errorf("se necesitan al menos 2 jugadores para comenzar")
	}

	colors := make([]game.Color, 0, len(r.Seats))
	for _, s := range r.Seats {
		colors = append(colors, s.Color)
	}
	_, draws := game.DrawTurnOrder(colors)
	for i, d := range draws {
		seat := r.seatByColor(d.Color)
		seat.Order = i + 1
		seat.Rolls = d.Rolls
		seat.Picked = false
	}
	r.botPickAt = time.Now().Add(botPickDelay)
	r.startBotLoop()
	r.changed()
	return nil
}

// PickColor elige el color del jugador al que le toca elegir.
func (r *Room) PickColor(c *Conn, color game.Color) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	seat := r.seatOf(c)
	if seat == nil {
		return fmt.Errorf("no estás en esta partida")
	}
	if err := r.pick(seat, color); err != nil {
		return err
	}
	r.changed()
	return nil
}

// pick le asigna el color al lugar. Si lo tenía de forma provisoria alguien
// que todavía no eligió, intercambian. Con el último, empieza la partida.
func (r *Room) pick(seat *Seat, color game.Color) error {
	if !r.picking() {
		return fmt.Errorf("no se están eligiendo colores")
	}
	if seat != r.nextPicker() {
		return fmt.Errorf("todavía no te toca elegir color")
	}
	valid := false
	for _, c := range game.AllColors {
		valid = valid || c == color
	}
	if !valid {
		return fmt.Errorf("color inválido")
	}
	if holder := r.seatByColor(color); holder != nil && holder != seat {
		if holder.Picked {
			return fmt.Errorf("ese color ya lo eligió %s", holder.Name)
		}
		holder.Color = seat.Color
	}
	seat.Color = color
	seat.Picked = true

	if r.nextPicker() == nil {
		r.beginGame()
	}
	return nil
}

// beginGame arma el tablero con los colores elegidos y el orden sorteado.
func (r *Room) beginGame() {
	seats := append([]*Seat(nil), r.Seats...)
	sort.Slice(seats, func(i, j int) bool { return seats[i].Order < seats[j].Order })

	players := make(map[game.Color]*game.PlayerState, len(seats))
	order := make([]game.Color, 0, len(seats))
	draws := make([]game.TurnDraw, 0, len(seats))
	missions := game.ShuffledMissions()
	summary := ""
	for i, s := range seats {
		players[s.Color] = &game.PlayerState{
			Color:   s.Color,
			Name:    s.Name,
			IsBot:   s.IsBot,
			IsHost:  s.IsHost,
			Mission: missions[i%len(missions)],
		}
		order = append(order, s.Color)
		draws = append(draws, game.TurnDraw{Color: s.Color, Rolls: s.Rolls})
		if i > 0 {
			summary += ", "
		}
		summary += fmt.Sprintf("%d° %s %v", i+1, s.Name, s.Rolls)
	}

	r.Board = game.NewGameBoard(players, order)
	r.Board.TurnDraw = draws
	r.Board.AddLog("Sorteo de turnos: " + summary + ".")
	for _, s := range r.Seats {
		s.Order, s.Rolls, s.Picked = 0, nil, false
	}
}

// ---------------------------------------------------------------------------
// Jugadas

// Play ejecuta una jugada del jugador sentado en la conexión. Mientras la
// partida está pausada nadie juega.
func (r *Room) Play(c *Conn, action func(b *game.GameBoard, color game.Color) error) error {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	seat := r.seatOf(c)
	if seat == nil {
		if r.spectators[c] {
			return fmt.Errorf("estás mirando la partida")
		}
		return fmt.Errorf("no estás en esta partida")
	}
	if r.Board == nil {
		return fmt.Errorf("la partida no empezó")
	}
	if names := r.waitingFor(); len(names) > 0 {
		return fmt.Errorf("partida en pausa: esperando a %s", joinNames(names))
	}
	if err := action(r.Board, seat.Color); err != nil {
		return err
	}
	r.changed()
	return nil
}

// Attack es como Play, pero además avisa a todos el resultado de los dados.
func (r *Room) Attack(c *Conn, from, to int) error {
	var res *game.CombatResult
	err := r.Play(c, func(b *game.GameBoard, color game.Color) error {
		var err error
		res, err = b.PerformAttack(color, from, to)
		return err
	})
	if err == nil && res != nil {
		r.Mu.Lock()
		r.sendCombat(res)
		r.Mu.Unlock()
	}
	return err
}

func joinNames(names []string) string {
	out := ""
	for i, n := range names {
		if i > 0 {
			out += ", "
		}
		out += n
	}
	return out
}

// ---------------------------------------------------------------------------
// Bots

// Tiempo para ver los dados del sorteo antes de que los bots elijan color, y
// pausa entre la elección de un bot y la siguiente.
const (
	botPickDelay = 3500 * time.Millisecond
	botPickPause = 900 * time.Millisecond
)

// Pausa extra tras un ataque de un bot, para que los jugadores alcancen a ver
// el resultado de los dados antes de la siguiente jugada.
const botCombatPause = 1800 * time.Millisecond

func (r *Room) startBotLoop() {
	if r.botLoop {
		return
	}
	r.botLoop = true
	go r.runBotLoop()
}

func (r *Room) runBotLoop() {
	pause := time.Duration(0)
	for {
		time.Sleep(500*time.Millisecond + pause)
		pause = 0

		r.Mu.Lock()
		if !r.closed && r.picking() {
			if s := r.nextPicker(); s != nil && s.IsBot && time.Now().After(r.botPickAt) {
				_ = r.pick(s, r.botColor())
				r.changed()
				pause = botPickPause
			}
			r.Mu.Unlock()
			continue
		}
		if r.closed || r.Board == nil || r.Board.CurrentPhase == game.PhaseFinished {
			r.botLoop = false
			r.Mu.Unlock()
			return
		}
		p := r.Board.CurrentPlayer()
		if p == nil || !p.IsBot || len(r.waitingFor()) > 0 {
			r.Mu.Unlock()
			continue
		}

		runner := bot.NewBotRunner(p.Color)
		acted := runner.TakeStep(r.Board)
		if runner.LastCombat != nil {
			r.sendCombat(runner.LastCombat)
			pause = botCombatPause
		}
		if acted {
			r.changed()
		}
		r.Mu.Unlock()
	}
}

// botColor elige al azar un color que nadie eligió todavía.
func (r *Room) botColor() game.Color {
	var free []game.Color
	for _, c := range game.AllColors {
		if s := r.seatByColor(c); s == nil || !s.Picked {
			free = append(free, c)
		}
	}
	return free[rand.Intn(len(free))]
}

// ---------------------------------------------------------------------------
// Estado: persistencia y envío a los clientes

// changed guarda la sala y avisa a todos. Se llama con el lock tomado.
func (r *Room) changed() {
	r.save()
	r.broadcast()
}

func (r *Room) save() {
	if r.manager == nil || r.manager.store == nil {
		return
	}
	seats, _ := json.Marshal(r.Seats)
	var board json.RawMessage
	if r.Board != nil {
		board, _ = json.Marshal(r.Board)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := r.manager.store.SaveRoom(ctx, store.RoomRecord{
		Code:         r.Code,
		Name:         r.Name,
		MaxPlayers:   r.MaxPlayers,
		PasswordHash: r.passwordHash,
		Status:       r.status(),
		Seats:        seats,
		Board:        board,
		CreatedAt:    r.CreatedAt,
	})
	if err != nil {
		log.Printf("guardando la sala %s: %v", r.Code, err)
	}
}

func (r *Room) close() {
	r.closed = true
	if r.manager != nil {
		r.manager.remove(r.Code)
	}
}

// SeatView es lo que ven los clientes de cada lugar.
type SeatView struct {
	Color     game.Color `json:"color"`
	Name      string     `json:"name"`
	IsBot     bool       `json:"isBot"`
	IsHost    bool       `json:"isHost"`
	Connected bool       `json:"connected"`
	Order     int        `json:"order,omitempty"`
	Rolls     []int      `json:"rolls,omitempty"`
	Picked    bool       `json:"picked,omitempty"`
}

type YouView struct {
	Role   string     `json:"role"` // "player" o "spectator"
	Color  game.Color `json:"color,omitempty"`
	IsHost bool       `json:"isHost"`
}

func (r *Room) seatViews() []SeatView {
	out := make([]SeatView, 0, len(r.Seats))
	for _, s := range r.Seats {
		out = append(out, SeatView{
			Color: s.Color, Name: s.Name, IsBot: s.IsBot, IsHost: s.IsHost, Connected: s.IsBot || s.conn != nil,
			Order: s.Order, Rolls: s.Rolls, Picked: s.Picked,
		})
	}
	return out
}

// broadcast le manda a cada conexión el estado de la sala, con el tablero
// filtrado para que nadie vea las misiones ni las tarjetas ajenas.
func (r *Room) broadcast() {
	base := map[string]any{
		"type":       "GAME_STATE",
		"room":       r.Code,
		"name":       r.Name,
		"status":     r.status(),
		"started":    r.Board != nil,
		"picking":    r.picking(),
		"maxPlayers": r.MaxPlayers,
		"private":    r.Private(),
		"seats":      r.seatViews(),
		"spectators": len(r.spectators),
		"waitingFor": r.waitingFor(),
	}
	send := func(c *Conn, you YouView) {
		msg := make(map[string]any, len(base)+2)
		for k, v := range base {
			msg[k] = v
		}
		msg["you"] = you
		if r.Board != nil {
			msg["board"] = r.Board.ViewFor(you.Color)
		}
		c.SendJSON(msg)
	}
	for _, s := range r.Seats {
		if s.conn != nil {
			send(s.conn, YouView{Role: "player", Color: s.Color, IsHost: s.IsHost})
		}
	}
	for c := range r.spectators {
		send(c, YouView{Role: "spectator"})
	}
}

func (r *Room) sendCombat(res *game.CombatResult) {
	msg := map[string]any{"type": "COMBAT_EVENT", "combatResult": res}
	for _, s := range r.Seats {
		if s.conn != nil {
			s.conn.SendJSON(msg)
		}
	}
	for c := range r.spectators {
		c.SendJSON(msg)
	}
}

// Summary es la fila de la sala en el navegador de partidas.
type Summary struct {
	Code       string     `json:"code"`
	Name       string     `json:"name"`
	Host       string     `json:"host"`
	Players    int        `json:"players"`
	MaxPlayers int        `json:"maxPlayers"`
	Status     string     `json:"status"`
	Paused     bool       `json:"paused"`
	Private    bool       `json:"private"`
	Spectators int        `json:"spectators"`
	CreatedAt  time.Time  `json:"createdAt"`
	Seats      []SeatView `json:"seats"`
	Mine       bool       `json:"mine"`
	CanDelete  bool       `json:"canDelete"`
}

func (r *Room) Summary(viewer Identity) Summary {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	s := Summary{
		Code:       r.Code,
		Name:       r.Name,
		Players:    len(r.Seats),
		MaxPlayers: r.MaxPlayers,
		Status:     r.status(),
		Paused:     len(r.waitingFor()) > 0,
		Private:    r.Private(),
		Spectators: len(r.spectators),
		CreatedAt:  r.CreatedAt,
		Seats:      r.seatViews(),
	}
	if h := r.host(); h != nil {
		s.Host = h.Name
	}
	for _, seat := range r.Seats {
		if seat.belongsTo(viewer) {
			s.Mine = true
		}
	}
	s.CanDelete = r.canDelete(viewer)
	return s
}
