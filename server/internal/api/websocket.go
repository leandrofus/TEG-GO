package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"

	"teg-server/internal/game"
	"teg-server/internal/lobby"
)

var upgrader = websocket.Upgrader{
	// La cookie de sesión es SameSite=Lax, así que una página de otro sitio no
	// puede abrir el websocket con la sesión del usuario.
	CheckOrigin: func(r *http.Request) bool { return true },
}

type wsMessage struct {
	Action        string     `json:"action"`
	RoomCode      string     `json:"roomCode"`
	Password      string     `json:"password"`
	Spectate      bool       `json:"spectate"`
	CountryID     int        `json:"countryId"`
	FromCountryID int        `json:"fromCountryId"`
	ToCountryID   int        `json:"toCountryId"`
	Count         int        `json:"count"`
	CardIDs       []int      `json:"cardIds"`
	Color         game.Color `json:"color"`
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	id, ok := s.identity(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Iniciá sesión para jugar.")
		return
	}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	conn := lobby.NewConn(ws, id)

	var room *lobby.Room
	defer func() {
		if room != nil {
			room.Disconnect(conn)
		}
		ws.Close()
	}()

	for {
		_, data, err := ws.ReadMessage()
		if err != nil {
			return
		}
		var msg wsMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		if msg.Action == "JOIN_ROOM" {
			next, err := s.rooms.Get(msg.RoomCode)
			if err == nil {
				if room != nil && room != next {
					room.Disconnect(conn)
				}
				err = next.Join(conn, msg.Password, msg.Spectate)
			}
			if err != nil {
				conn.SendJSON(map[string]string{"type": "JOIN_FAILED", "message": err.Error()})
				continue
			}
			room = next
			continue
		}

		if room == nil {
			conn.SendError("No estás en ninguna sala.")
			continue
		}
		if err := s.dispatch(room, conn, msg); err != nil {
			conn.SendError(err.Error())
		}
		if msg.Action == "LEAVE_ROOM" || msg.Action == "EXIT_ROOM" {
			room = nil
			conn.SendJSON(map[string]string{"type": "LEFT_ROOM"})
		}
	}
}

func (s *Server) dispatch(room *lobby.Room, conn *lobby.Conn, msg wsMessage) error {
	play := func(action func(b *game.GameBoard, c game.Color) error) error {
		return room.Play(conn, action)
	}

	switch msg.Action {
	case "LEAVE_ROOM": // salir liberando el lugar (o dejándoselo a un bot)
		room.Leave(conn)
		return nil
	case "EXIT_ROOM": // volver al navegador conservando el lugar
		room.Disconnect(conn)
		return nil
	case "ADD_BOT":
		return room.AddBot(conn)
	case "REMOVE_SEAT":
		return room.RemoveSeat(conn, msg.Color)
	case "START_GAME":
		return room.Start(conn)
	case "REPLACE_WITH_BOT":
		return room.ReplaceWithBot(conn, msg.Color)

	case "PLACE_TROOPS":
		return play(func(b *game.GameBoard, c game.Color) error { return b.PlaceTroops(c, msg.CountryID, msg.Count) })
	case "TRADE_CARDS":
		return play(func(b *game.GameBoard, c game.Color) error { return b.TradeCards(c, msg.CardIDs) })
	case "CASH_CARD":
		return play(func(b *game.GameBoard, c game.Color) error { return b.CashCard(c, msg.CountryID) })
	case "SKIP_TRADE":
		return play(func(b *game.GameBoard, c game.Color) error { return b.SkipTrade(c) })
	case "ATTACK":
		return room.Attack(conn, msg.FromCountryID, msg.ToCountryID)
	case "MOVE_CONQUEST":
		return play(func(b *game.GameBoard, c game.Color) error { return b.MoveAfterConquest(c, msg.Count) })
	case "PASS_REARRANGE":
		return play(func(b *game.GameBoard, c game.Color) error { return b.PassToRearrange(c) })
	case "REARRANGE":
		return play(func(b *game.GameBoard, c game.Color) error {
			return b.RearrangeTroops(c, msg.FromCountryID, msg.ToCountryID, msg.Count)
		})
	case "END_TURN":
		return play(func(b *game.GameBoard, c game.Color) error { return b.EndTurn(c) })
	}
	return nil
}
