package lobby

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Identity es quién está detrás de una conexión: una cuenta (UserID) o un
// invitado, que se reconoce por el token de su sesión.
type Identity struct {
	UserID int64
	Token  string
	Name   string
	Guest  bool
}

// Conn envuelve un websocket: gorilla no admite escrituras concurrentes y acá
// escriben tanto el handler de la conexión como los broadcasts de la sala.
type Conn struct {
	ws       *websocket.Conn
	mu       sync.Mutex
	Identity Identity
	sent     [][]byte // sin websocket (tests), los mensajes quedan acá
}

func NewConn(ws *websocket.Conn, id Identity) *Conn {
	return &Conn{ws: ws, Identity: id}
}

func (c *Conn) Send(msg []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ws == nil {
		c.sent = append(c.sent, msg)
		return
	}
	_ = c.ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	_ = c.ws.WriteMessage(websocket.TextMessage, msg)
}

func (c *Conn) SendJSON(v any) {
	if msg, err := json.Marshal(v); err == nil {
		c.Send(msg)
	}
}

func (c *Conn) SendError(text string) {
	c.SendJSON(map[string]string{"type": "ERROR", "message": text})
}
