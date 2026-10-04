package lobby

import (
	"encoding/json"
	"testing"

	"teg-server/internal/game"
)

func player(id int64, name string) *Conn { return NewConn(nil, Identity{UserID: id, Name: name}) }

// lastState decodifica el último GAME_STATE que recibió la conexión.
func lastState(t *testing.T, c *Conn) map[string]any {
	t.Helper()
	for i := len(c.sent) - 1; i >= 0; i-- {
		var m map[string]any
		if json.Unmarshal(c.sent[i], &m) == nil && m["type"] == "GAME_STATE" {
			return m
		}
	}
	t.Fatal("no recibió ningún GAME_STATE")
	return nil
}

func startedRoom(t *testing.T) (*Room, *Conn, *Conn) {
	t.Helper()
	m := NewManager(nil)
	r, err := m.Create("Prueba", 4, "clave")
	if err != nil {
		t.Fatal(err)
	}
	ana, beto := player(1, "Ana"), player(2, "Beto")
	if err := r.Join(ana, "clave", false); err != nil {
		t.Fatal(err)
	}
	if err := r.Join(beto, "mala", false); err == nil {
		t.Fatal("entró con la contraseña equivocada")
	}
	if err := r.Join(beto, "clave", false); err != nil {
		t.Fatal(err)
	}
	if err := r.Start(beto); err == nil {
		t.Fatal("un jugador que no es anfitrión inició la partida")
	}
	if err := r.Start(ana); err != nil {
		t.Fatal(err)
	}
	return r, ana, beto
}

func TestDisconnectPausesAndReconnectResumes(t *testing.T) {
	r, ana, beto := startedRoom(t)
	r.Disconnect(beto)
	if got := r.waitingFor(); len(got) != 1 || got[0] != "Beto" {
		t.Fatalf("esperando a %v, se esperaba [Beto]", got)
	}
	if err := r.Play(ana, func(b *game.GameBoard, c game.Color) error { return nil }); err == nil {
		t.Error("se pudo jugar con la partida en pausa")
	}

	// Beto vuelve desde otra conexión: recupera su lugar sin contraseña
	again := player(2, "Beto")
	if err := r.Join(again, "", false); err != nil {
		t.Fatal(err)
	}
	if len(r.waitingFor()) != 0 {
		t.Error("la partida sigue en pausa tras volver Beto")
	}
	if you := lastState(t, again)["you"].(map[string]any); you["role"] != "player" {
		t.Errorf("Beto volvió como %v", you["role"])
	}
}

func TestHostReplacesAbsentPlayerWithBot(t *testing.T) {
	r, ana, beto := startedRoom(t)
	r.Disconnect(beto)
	seat := r.seatOf(ana)
	other := r.Seats[0]
	if other == seat {
		other = r.Seats[1]
	}
	if err := r.ReplaceWithBot(ana, other.Color); err != nil {
		t.Fatal(err)
	}
	if !other.IsBot || !r.Board.Players[other.Color].IsBot || len(r.waitingFor()) != 0 {
		t.Error("el lugar de Beto no pasó a un bot o la partida sigue en pausa")
	}
}

func TestStateHidesOtherPlayersSecrets(t *testing.T) {
	r, ana, _ := startedRoom(t)
	r.Mu.Lock()
	r.broadcast()
	r.Mu.Unlock()

	state := lastState(t, ana)
	mine := string(r.seatOf(ana).Color)
	players := state["board"].(map[string]any)["players"].(map[string]any)
	for color, p := range players {
		id := p.(map[string]any)["mission"].(map[string]any)["id"].(float64)
		if color == mine && id == 0 {
			t.Error("Ana no ve su propia misión")
		}
		if color != mine && id != 0 {
			t.Errorf("Ana ve la misión de %s", color)
		}
	}
}

func TestLeavingWaitingRoomPassesHost(t *testing.T) {
	m := NewManager(nil)
	r, _ := m.Create("Prueba", 4, "")
	ana, beto := player(1, "Ana"), player(2, "Beto")
	_ = r.Join(ana, "", false)
	_ = r.Join(beto, "", false)
	r.Leave(ana)
	if len(r.Seats) != 1 || !r.Seats[0].IsHost || r.Seats[0].Name != "Beto" {
		t.Errorf("tras irse Ana, lugares = %+v", r.Seats)
	}
	r.Leave(beto)
	if _, err := m.Get(r.Code); err == nil {
		t.Error("la sala vacía no se borró")
	}
}

func TestDeleteOnlyByHostWithoutOtherHumans(t *testing.T) {
	m := NewManager(nil)
	r, _ := m.Create("Prueba", 4, "")
	ana, beto := player(1, "Ana"), player(2, "Beto")
	_ = r.Join(ana, "", false)
	_ = r.Join(beto, "", false)
	if err := r.Delete(ana.Identity); err == nil {
		t.Fatal("se borró la sala con otro jugador adentro")
	}
	r.Leave(beto)
	_ = r.AddBot(ana)
	if err := r.Delete(beto.Identity); err == nil {
		t.Fatal("alguien que no es el anfitrión borró la sala")
	}
	if !r.Summary(ana.Identity).CanDelete {
		t.Error("el anfitrión solo con bots debería poder borrar la sala")
	}
	if err := r.Delete(ana.Identity); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Get(r.Code); err == nil {
		t.Error("la sala sigue existiendo después de borrarla")
	}
}
