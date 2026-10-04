package game

import "testing"

// Tablero mínimo de 2 jugadores en fase de ataque, con Argentina (1) de rojo
// y Uruguay (3), limítrofe, de azul.
func attackBoard(fromArmies int) *GameBoard {
	players := map[Color]*PlayerState{
		ColorRed:  {Color: ColorRed, Name: "Rojo", IsAlive: true},
		ColorBlue: {Color: ColorBlue, Name: "Azul", IsAlive: true},
	}
	g := &GameBoard{
		Countries:    map[int]*CountryState{},
		Players:      players,
		TurnOrder:    []Color{ColorRed, ColorBlue},
		CurrentPhase: PhaseAttack,
	}
	for id := 1; id <= 50; id++ {
		g.Countries[id] = &CountryState{ID: id, Owner: ColorBlue, Armies: 1}
	}
	g.Countries[1].Owner = ColorRed
	g.Countries[1].Armies = fromArmies
	g.Countries[2].Owner = ColorRed // para que Azul no quede eliminado ni Rojo gane
	return g
}

// Ataca hasta conquistar Uruguay (el defensor tiene 1 ejército).
func conquer(t *testing.T, g *GameBoard, fromArmies int) {
	t.Helper()
	for i := 0; i < 200; i++ {
		g.Countries[1].Armies = fromArmies
		g.Countries[3].Owner, g.Countries[3].Armies = ColorBlue, 1
		res, err := g.PerformAttack(ColorRed, 1, 3)
		if err != nil {
			t.Fatal(err)
		}
		if res.Conquered {
			if res.Attacker != ColorRed || res.Defender != ColorBlue {
				t.Fatalf("atacante/defensor = %s/%s", res.Attacker, res.Defender)
			}
			return
		}
	}
	t.Fatal("no se logró conquistar")
}

func TestConquestLetsAttackerMoveUpToThree(t *testing.T) {
	g := attackBoard(6)
	conquer(t, g, 6)

	pc := g.PendingConquest
	if pc == nil || pc.From != 1 || pc.To != 3 || pc.Max != 3 {
		t.Fatalf("conquista pendiente = %+v, se esperaba 1->3 con máximo 3", pc)
	}

	// Mientras está pendiente no se puede seguir atacando ni terminar el turno
	if _, err := g.PerformAttack(ColorRed, 1, 3); err == nil {
		t.Error("se pudo atacar con una conquista pendiente")
	}
	if err := g.PassToRearrange(ColorRed); err == nil {
		t.Error("se pudo pasar a reagrupar con una conquista pendiente")
	}
	if err := g.MoveAfterConquest(ColorRed, 4); err == nil {
		t.Error("se aceptó pasar 4 ejércitos")
	}

	if err := g.MoveAfterConquest(ColorRed, 3); err != nil {
		t.Fatal(err)
	}
	if g.Countries[1].Armies != 3 || g.Countries[3].Armies != 3 {
		t.Errorf("origen/destino = %d/%d, se esperaba 3/3", g.Countries[1].Armies, g.Countries[3].Armies)
	}
	if g.PendingConquest != nil {
		t.Error("la conquista sigue pendiente")
	}
}

func TestConquestKeepsOneInOrigin(t *testing.T) {
	// Con 3 ejércitos: tras conquistar quedan 2 en el origen, se pueden pasar 2 en total
	g := attackBoard(3)
	conquer(t, g, 3)
	if g.PendingConquest == nil || g.PendingConquest.Max != 2 {
		t.Fatalf("conquista pendiente = %+v, se esperaba máximo 2", g.PendingConquest)
	}

	// Con 2 ejércitos solo puede pasar 1: no queda nada por decidir
	g = attackBoard(2)
	conquer(t, g, 2)
	if g.PendingConquest != nil {
		t.Fatalf("conquista pendiente = %+v, no debería haber", g.PendingConquest)
	}
	if g.Countries[1].Armies != 1 || g.Countries[3].Armies != 1 {
		t.Errorf("origen/destino = %d/%d, se esperaba 1/1", g.Countries[1].Armies, g.Countries[3].Armies)
	}
}

func TestCardOfOwnCountryGivesTwoArmies(t *testing.T) {
	for _, tc := range []struct {
		name   string
		cardID int
		want   int
		cashed bool
	}{
		{"país propio", 2, 3, true}, // Brasil es de Rojo: 1 + 2
		{"país ajeno", 5, 1, false}, // Colombia es de Azul
	} {
		g := attackBoard(4)
		g.CurrentPhase = PhaseRearrange
		g.Players[ColorRed].ConqueredTurn = true
		g.CardDeck = []int{tc.cardID}

		if err := g.EndTurn(ColorRed); err != nil {
			t.Fatal(err)
		}
		cards := g.Players[ColorRed].Cards
		if len(cards) != 1 || cards[0].CountryID != tc.cardID || cards[0].Cashed != tc.cashed {
			t.Errorf("%s: tarjetas = %+v", tc.name, cards)
		}
		if got := g.Countries[tc.cardID].Armies; got != tc.want {
			t.Errorf("%s: el país tiene %d ejércitos, se esperaban %d", tc.name, got, tc.want)
		}
	}
}

// Los ejércitos que entraron conquistando se pueden reagrupar; los que llegan
// durante el reagrupe ya no se vuelven a mover.
func TestRearrangeAfterConquest(t *testing.T) {
	g := attackBoard(6)
	conquer(t, g, 6)
	if err := g.MoveAfterConquest(ColorRed, 2); err != nil {
		t.Fatal(err)
	}
	// Uruguay (3) quedó con 2; Brasil (2) es de Rojo y limita con Uruguay
	if err := g.PassToRearrange(ColorRed); err != nil {
		t.Fatal(err)
	}
	if err := g.RearrangeTroops(ColorRed, 3, 2, 1); err != nil {
		t.Fatalf("no se pudo mover desde el país conquistado: %v", err)
	}
	// Brasil recibió 1 en este reagrupe: no puede reenviarlo
	if err := g.RearrangeTroops(ColorRed, 2, 1, 1); err == nil {
		t.Error("se pudo volver a mover un ejército que llegó en el reagrupe")
	}
	// Argentina (1) conserva libres todos sus ejércitos menos 1
	free := g.Countries[1].Armies - 1
	if err := g.RearrangeTroops(ColorRed, 1, 2, free); err != nil {
		t.Errorf("Argentina no pudo mover sus %d ejércitos libres: %v", free, err)
	}
}

func TestDrawTurnOrder(t *testing.T) {
	colors := []Color{ColorRed, ColorBlue, ColorGreen, ColorYellow, ColorBlack, ColorMagenta}
	for n := 0; n < 200; n++ {
		order, draws := DrawTurnOrder(colors)
		if len(order) != len(colors) || len(draws) != len(colors) {
			t.Fatalf("orden incompleto: %v", order)
		}
		seen := map[Color]bool{}
		for i, d := range draws {
			if d.Color != order[i] || seen[d.Color] {
				t.Fatalf("tiradas y orden no coinciden: %v %v", order, draws)
			}
			seen[d.Color] = true
			if i == 0 {
				continue
			}
			// Cada jugador queda detrás del anterior por la primera tirada distinta
			a, b := draws[i-1].Rolls, d.Rolls
			k := 0
			for k < len(a) && k < len(b) && a[k] == b[k] {
				k++
			}
			if k == len(a) || k == len(b) || a[k] < b[k] {
				t.Fatalf("desempate mal resuelto: %v antes que %v", a, b)
			}
		}
	}
}

func TestRoundAdvancesWhenOrderWraps(t *testing.T) {
	players := map[Color]*PlayerState{ColorRed: {Color: ColorRed}, ColorBlue: {Color: ColorBlue}}
	g := NewGameBoard(players, []Color{ColorRed, ColorBlue})
	g.CurrentPhase = PhaseAttack
	g.Round = 1
	_ = g.EndTurn(ColorRed)
	if g.Round != 1 {
		t.Fatalf("ronda %d a mitad de vuelta, se esperaba 1", g.Round)
	}
	g.CurrentPhase = PhaseAttack
	_ = g.EndTurn(ColorBlue)
	if g.Round != 2 || g.CurrentTurnIndex != 0 {
		t.Fatalf("ronda %d, turno %d; se esperaba ronda 2 y turno 0", g.Round, g.CurrentTurnIndex)
	}
}
