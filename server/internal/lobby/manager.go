package lobby

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"teg-server/internal/game"
	"teg-server/internal/store"
)

type Manager struct {
	mu    sync.RWMutex
	rooms map[string]*Room
	store *store.Store // nil en tests: las salas viven solo en memoria
}

func NewManager(st *store.Store) *Manager {
	return &Manager{rooms: make(map[string]*Room), store: st}
}

// Create arma una sala vacía; el creador entra después por el websocket y,
// como es el primero, queda de anfitrión.
func (m *Manager) Create(name string, maxPlayers int, password string) (*Room, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Sala de TEG"
	}
	if len([]rune(name)) > 40 {
		return nil, fmt.Errorf("el nombre de la sala puede tener hasta 40 caracteres")
	}
	if maxPlayers < 2 || maxPlayers > 6 {
		maxPlayers = 6
	}

	r := &Room{
		Name:       name,
		MaxPlayers: maxPlayers,
		CreatedAt:  time.Now(),
		spectators: make(map[*Conn]bool),
		manager:    m,
	}
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		r.passwordHash = string(hash)
	}

	m.mu.Lock()
	for {
		r.Code = generateCode(6)
		if _, taken := m.rooms[r.Code]; !taken {
			break
		}
	}
	m.rooms[r.Code] = r
	m.mu.Unlock()

	r.Mu.Lock()
	r.save()
	r.Mu.Unlock()
	return r, nil
}

func (m *Manager) Get(code string) (*Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.rooms[strings.ToUpper(strings.TrimSpace(code))]
	if !ok {
		return nil, fmt.Errorf("la sala '%s' no existe", code)
	}
	return r, nil
}

// List devuelve las salas visibles en el navegador, de la más nueva a la más vieja.
func (m *Manager) List(viewer Identity) []Summary {
	m.mu.RLock()
	rooms := make([]*Room, 0, len(m.rooms))
	for _, r := range m.rooms {
		rooms = append(rooms, r)
	}
	m.mu.RUnlock()

	out := make([]Summary, 0, len(rooms))
	for _, r := range rooms {
		// Las salas recién creadas a las que todavía no entró nadie no se listan
		if s := r.Summary(viewer); s.Status != StatusFinished && s.Players > 0 {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (m *Manager) remove(code string) {
	m.mu.Lock()
	delete(m.rooms, code)
	m.mu.Unlock()
	if m.store != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := m.store.DeleteRoom(ctx, code); err != nil {
			log.Printf("borrando la sala %s: %v", code, err)
		}
	}
}

// Restore recarga las salas guardadas. Nadie está conectado todavía, así que
// las partidas en curso quedan en pausa hasta que vuelvan sus jugadores.
func (m *Manager) Restore(ctx context.Context) error {
	records, err := m.store.ActiveRooms(ctx)
	if err != nil {
		return err
	}
	for _, rec := range records {
		r := &Room{
			Code:         rec.Code,
			Name:         rec.Name,
			MaxPlayers:   rec.MaxPlayers,
			CreatedAt:    rec.CreatedAt,
			passwordHash: rec.PasswordHash,
			spectators:   make(map[*Conn]bool),
			manager:      m,
		}
		if err := json.Unmarshal(rec.Seats, &r.Seats); err != nil {
			log.Printf("sala %s: lugares ilegibles: %v", rec.Code, err)
			continue
		}
		if len(rec.Board) > 0 {
			r.Board = &game.GameBoard{}
			if err := json.Unmarshal(rec.Board, r.Board); err != nil {
				log.Printf("sala %s: tablero ilegible: %v", rec.Code, err)
				continue
			}
		}
		m.rooms[r.Code] = r
		if r.Board != nil {
			r.Mu.Lock()
			r.startBotLoop()
			r.Mu.Unlock()
		}
	}
	log.Printf("Salas recuperadas de la base: %d", len(records))
	return nil
}

// StartJanitor borra cada tanto las salas de espera en las que no queda
// ningún humano conectado (las partidas en curso se conservan para retomarlas).
func (m *Manager) StartJanitor(idle time.Duration) {
	lastSeen := map[string]time.Time{}
	go func() {
		for range time.Tick(time.Minute) {
			m.mu.RLock()
			rooms := make([]*Room, 0, len(m.rooms))
			for _, r := range m.rooms {
				rooms = append(rooms, r)
			}
			m.mu.RUnlock()

			now := time.Now()
			for _, r := range rooms {
				r.Mu.Lock()
				active := r.Board != nil || len(r.spectators) > 0
				for _, s := range r.Seats {
					active = active || s.conn != nil
				}
				if active {
					lastSeen[r.Code] = now
				} else if seen, ok := lastSeen[r.Code]; !ok {
					lastSeen[r.Code] = now
				} else if now.Sub(seen) > idle {
					r.close()
					delete(lastSeen, r.Code)
				}
				r.Mu.Unlock()
			}
		}
	}()
}

func generateCode(length int) string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
