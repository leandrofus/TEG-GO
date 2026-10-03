// Package api expone la API HTTP (cuentas y salas) y el websocket del juego.
package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"teg-server/internal/game"
	"teg-server/internal/lobby"
	"teg-server/internal/store"
)

const (
	sessionCookie   = "teg_session"
	userSessionTTL  = 30 * 24 * time.Hour
	guestSessionTTL = 24 * time.Hour
)

var usernameRe = regexp.MustCompile(`^[A-Za-z0-9_]{3,20}$`)

type Server struct {
	store *store.Store
	rooms *lobby.Manager
}

func New(st *store.Store, rooms *lobby.Manager) *Server {
	return &Server{store: st, rooms: rooms}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/guest", s.handleGuest)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/auth/me", s.handleMe)

	mux.HandleFunc("GET /api/rooms", s.handleListRooms)
	mux.HandleFunc("POST /api/rooms", s.handleCreateRoom)

	mux.HandleFunc("GET /api/game/data", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"countries":  game.CountriesData,
			"continents": game.ContinentsData,
		})
	})

	mux.HandleFunc("GET /ws", s.handleWS)

	// Frontend compilado (SPA), si está disponible
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "../frontend/dist"
	}
	if _, err := os.Stat(staticDir); err == nil {
		mux.Handle("/", http.FileServer(http.Dir(staticDir)))
	}
	return mux
}

// ---------------------------------------------------------------------------
// Sesiones

type meResponse struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Guest bool   `json:"guest"`
}

// identity devuelve quién hace el pedido según la cookie de sesión.
func (s *Server) identity(r *http.Request) (lobby.Identity, bool) {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || cookie.Value == "" {
		return lobby.Identity{}, false
	}
	sess, err := s.store.GetSession(r.Context(), cookie.Value)
	if err != nil {
		return lobby.Identity{}, false
	}
	return lobby.Identity{UserID: sess.UserID, Token: sess.Token, Name: sess.Name, Guest: sess.Guest}, true
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID int64, guestName string, ttl time.Duration) (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	token := hex.EncodeToString(buf)
	if err := s.store.CreateSession(r.Context(), token, userID, guestName, ttl); err != nil {
		return "", err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})
	return token, nil
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct{ Username, Password string }
	if !readJSON(w, r, &req) {
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if !usernameRe.MatchString(req.Username) {
		writeError(w, http.StatusBadRequest, "El usuario debe tener entre 3 y 20 letras, números o _.")
		return
	}
	if len(req.Password) < 6 || len(req.Password) > 72 {
		writeError(w, http.StatusBadRequest, "La contraseña debe tener entre 6 y 72 caracteres.")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "No se pudo crear la cuenta.")
		return
	}
	user, err := s.store.CreateUser(r.Context(), req.Username, string(hash))
	if errors.Is(err, store.ErrUsernameTaken) {
		writeError(w, http.StatusConflict, "Ese usuario ya existe.")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "No se pudo crear la cuenta.")
		return
	}
	if _, err := s.startSession(w, r, user.ID, "", userSessionTTL); err != nil {
		writeError(w, http.StatusInternalServerError, "No se pudo iniciar la sesión.")
		return
	}
	writeJSON(w, http.StatusCreated, meResponse{ID: user.ID, Name: user.Username})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct{ Username, Password string }
	if !readJSON(w, r, &req) {
		return
	}
	user, hash, err := s.store.UserWithPassword(r.Context(), strings.TrimSpace(req.Username))
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "Usuario o contraseña incorrectos.")
		return
	}
	if _, err := s.startSession(w, r, user.ID, "", userSessionTTL); err != nil {
		writeError(w, http.StatusInternalServerError, "No se pudo iniciar la sesión.")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{ID: user.ID, Name: user.Username})
}

func (s *Server) handleGuest(w http.ResponseWriter, r *http.Request) {
	var req struct{ Name string }
	if !readJSON(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	if n := len([]rune(name)); n < 2 || n > 20 {
		writeError(w, http.StatusBadRequest, "El nombre debe tener entre 2 y 20 caracteres.")
		return
	}
	if _, err := s.startSession(w, r, 0, name, guestSessionTTL); err != nil {
		writeError(w, http.StatusInternalServerError, "No se pudo iniciar la sesión.")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{Name: name, Guest: true})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		_ = s.store.DeleteSession(r.Context(), cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	id, ok := s.identity(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "No iniciaste sesión.")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{ID: id.UserID, Name: id.Name, Guest: id.Guest})
}

// ---------------------------------------------------------------------------
// Salas

func (s *Server) handleListRooms(w http.ResponseWriter, r *http.Request) {
	id, _ := s.identity(r)
	writeJSON(w, http.StatusOK, s.rooms.List(id))
}

func (s *Server) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.identity(r); !ok {
		writeError(w, http.StatusUnauthorized, "Iniciá sesión para crear una sala.")
		return
	}
	var req struct {
		Name       string `json:"name"`
		MaxPlayers int    `json:"maxPlayers"`
		Password   string `json:"password"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	room, err := s.rooms.Create(req.Name, req.MaxPlayers, req.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"code": room.Code})
}

// ---------------------------------------------------------------------------

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "Pedido inválido.")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
