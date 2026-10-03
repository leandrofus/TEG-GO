package bot

import (
	"testing"

	"teg-server/internal/game"
)

func newBotGame(n int) *game.GameBoard {
	players := make(map[game.Color]*game.PlayerState)
	order := make([]game.Color, 0, n)
	for i, c := range game.AllColors[:n] {
		players[c] = &game.PlayerState{
			Color:   c,
			Name:    string(c),
			IsBot:   true,
			Mission: game.SecretMissions[i%len(game.SecretMissions)],
		}
		order = append(order, c)
	}
	return game.NewGameBoard(players, order)
}

// La colocación inicial reparte 5 ejércitos a cada jugador en la primera ronda
// y 3 en la segunda, y luego arranca el primer turno normal.
func TestInitialPlacementRounds(t *testing.T) {
	for _, n := range []int{2, 3, 4, 6} {
		board := newBotGame(n)
		total := func() int {
			sum := 0
			for _, c := range board.Countries {
				sum += c.Armies
			}
			return sum
		}

		for step := 0; board.CurrentPhase == game.PhaseInitialPlacement1 || board.CurrentPhase == game.PhaseInitialPlacement2; step++ {
			if step > 1000 {
				t.Fatalf("%d jugadores: la colocación inicial no termina (fase %s)", n, board.CurrentPhase)
			}
			if !NewBotRunner(board.CurrentPlayer().Color).TakeStep(board) {
				t.Fatalf("%d jugadores: el bot %s no puede actuar en %s con %d tropas",
					n, board.CurrentPlayer().Color, board.CurrentPhase, board.CurrentPlayer().TroopsToPlace)
			}
		}

		if want := 50 + n*(5+3); total() != want {
			t.Errorf("%d jugadores: hay %d ejércitos tras la colocación inicial, se esperaban %d", n, total(), want)
		}
		if board.CurrentPhase != game.PhaseTradeCards {
			t.Errorf("%d jugadores: fase %s tras la colocación inicial, se esperaba %s", n, board.CurrentPhase, game.PhaseTradeCards)
		}
	}
}

// Una partida solo de bots tiene que avanzar siempre: ningún paso puede quedar
// sin acción posible (por ejemplo, un jugador eliminado que recibe su turno).
func TestBotGameNeverStalls(t *testing.T) {
	for i := range 20 {
		board := newBotGame(4)
		for step := 0; board.CurrentPhase != game.PhaseFinished && step < 20000; step++ {
			p := board.CurrentPlayer()
			if !p.IsAlive {
				t.Fatalf("partida %d: el turno quedó en %s, que está eliminado", i, p.Color)
			}
			if !NewBotRunner(p.Color).TakeStep(board) {
				t.Fatalf("partida %d paso %d: %s no puede actuar en %s (tropas: %d)",
					i, step, p.Color, board.CurrentPhase, p.TroopsToPlace)
			}
		}
	}
}
