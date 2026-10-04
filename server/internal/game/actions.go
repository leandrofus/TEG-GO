package game

import "fmt"

// PlaceTroops adds armies to a specified country during placement/add phases
func (g *GameBoard) PlaceTroops(color Color, countryID int, count int) error {
	p := g.Players[color]
	if p == nil {
		return fmt.Errorf("jugador no encontrado")
	}
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseInitialPlacement1 && g.CurrentPhase != PhaseInitialPlacement2 && g.CurrentPhase != PhaseAddArmies {
		return fmt.Errorf("no estás en fase de agregar tropas")
	}
	if count <= 0 || count > p.TroopsToPlace {
		return fmt.Errorf("cantidad de tropas inválida (%d disponible: %d)", count, p.TroopsToPlace)
	}

	c := g.Countries[countryID]
	if c == nil || c.Owner != color {
		return fmt.Errorf("el país no te pertenece")
	}

	c.Armies += count
	p.TroopsToPlace -= count
	g.AddLog(fmt.Sprintf("%s agregó %d tropa(s) en %s.", p.Name, count, CountriesData[countryID].Name))

	// If player finished placing troops, advance phase
	if p.TroopsToPlace == 0 {
		g.AdvancePhaseAfterPlacement()
	}

	return nil
}

// AdvancePhaseAfterPlacement handles phase progression after adding armies
func (g *GameBoard) AdvancePhaseAfterPlacement() {
	p := g.CurrentPlayer()

	switch g.CurrentPhase {
	case PhaseInitialPlacement1:
		g.NextTurnPlacement(PhaseInitialPlacement2, 3)
	case PhaseInitialPlacement2:
		g.NextTurnPlacement(PhaseTradeCards, 0)
	case PhaseAddArmies:
		g.CurrentPhase = PhaseAttack
		g.AddLog(fmt.Sprintf("Fase de Ataque para %s.", p.Name))
	}
}

// NextTurnPlacement pasa al siguiente jugador de la ronda de colocación inicial.
// Los ejércitos de cada ronda se reparten a todos al comenzarla, así que dentro
// de la ronda no se tocan; al terminarla se pasa a nextPhase con nextTroops
// para cada jugador (o al primer turno normal si nextPhase es PhaseTradeCards).
func (g *GameBoard) NextTurnPlacement(nextPhase Phase, nextTroops int) {
	g.CurrentTurnIndex++
	if g.CurrentTurnIndex < len(g.TurnOrder) {
		p := g.CurrentPlayer()
		g.AddLog(fmt.Sprintf("Turno de %s para colocar %d ejércitos.", p.Name, p.TroopsToPlace))
		return
	}

	g.CurrentTurnIndex = 0
	p := g.CurrentPlayer()
	if nextPhase == PhaseTradeCards {
		g.Round = 1
		g.AddLog("Comienza la ronda 1.")
		g.StartTurn(p.Color)
		return
	}

	g.CurrentPhase = nextPhase
	for _, player := range g.Players {
		player.TroopsToPlace = nextTroops
	}
	g.AddLog(fmt.Sprintf("Fase 2 de colocación inicial: %s coloca %d ejércitos.", p.Name, p.TroopsToPlace))
}

// StartTurn calculates turn bonuses and prepares player turn
func (g *GameBoard) StartTurn(color Color) {
	p := g.Players[color]
	p.ConqueredTurn = false

	// Reset moved status for all countries
	for _, c := range g.Countries {
		c.MovedThisTurn = 0
	}

	bonus := 0
	breakdown := map[string]int{}
	if g.Round > 1 {
		bonus, breakdown = g.CalculateTroopBonus(color)
	}
	p.TroopsToPlace = bonus
	p.TroopBonusMap = breakdown

	g.CurrentPhase = PhaseTradeCards
	if bonus > 0 {
		g.AddLog(fmt.Sprintf("Comienza el turno de %s. Recibe %d tropas.", p.Name, bonus))
	} else {
		g.AddLog(fmt.Sprintf("Comienza el turno de %s. Ya recibió las tropas iniciales de la ronda de placement.", p.Name))
	}
}

// SkipTrade moves player from Trade phase to AddArmies phase
func (g *GameBoard) SkipTrade(color Color) error {
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseTradeCards {
		return fmt.Errorf("fase incorrecta para canje")
	}
	if g.CurrentPlayer().TroopsToPlace == 0 {
		g.CurrentPhase = PhaseAttack
		g.AddLog(fmt.Sprintf("%s no tiene ejércitos para colocar y pasa a la fase de ataque.", g.CurrentPlayer().Name))
		return nil
	}
	g.CurrentPhase = PhaseAddArmies
	g.AddLog(fmt.Sprintf("%s pasa a la fase de colocación de tropas.", g.CurrentPlayer().Name))
	return nil
}

// PerformAttack executes an attack from country A to country B
func (g *GameBoard) PerformAttack(color Color, fromID, toID int) (*CombatResult, error) {
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return nil, fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseAttack {
		return nil, fmt.Errorf("no estás en fase de ataque")
	}
	if err := g.requireNoPendingConquest(); err != nil {
		return nil, err
	}

	from := g.Countries[fromID]
	to := g.Countries[toID]

	if from == nil || from.Owner != color {
		return nil, fmt.Errorf("el país de origen no te pertenece")
	}
	if to == nil || to.Owner == color {
		return nil, fmt.Errorf("el país de destino debe ser enemigo")
	}
	if !AreNeighbors(fromID, toID) {
		return nil, fmt.Errorf("%s y %s no son países limítrofes", CountriesData[fromID].Name, CountriesData[toID].Name)
	}
	if from.Armies <= 1 {
		return nil, fmt.Errorf("%s necesita más de 1 tropa para atacar", CountriesData[fromID].Name)
	}

	defender := to.Owner
	res := ExecuteAttack(from, to)
	p := g.CurrentPlayer()

	msg := fmt.Sprintf("%s atacó %s desde %s. Dados Atk: %v | Dados Def: %v.",
		p.Name, CountriesData[toID].Name, CountriesData[fromID].Name, res.AttackerDice, res.DefenderDice)
	g.AddLog(msg)

	if res.Conquered {
		p.ConqueredTurn = true
		g.AddLog(fmt.Sprintf("¡%s ha conquistado %s!", p.Name, CountriesData[toID].Name))
		g.checkElimination(color, defender)
		g.CheckVictory(color)

		// En el TEG se pueden pasar hasta 3 ejércitos, dejando al menos 1 en el
		// origen. Ya pasó 1; si puede pasar más, queda pendiente la decisión.
		if g.CurrentPhase == PhaseAttack {
			max := min(3, from.Armies)
			if max > 1 {
				g.PendingConquest = &PendingConquest{From: fromID, To: toID, Max: max}
			}
		}
	}

	return &res, nil
}

// MoveAfterConquest resuelve la conquista pendiente: count es el total de
// ejércitos que quedan en el país conquistado (entre 1 y PendingConquest.Max).
func (g *GameBoard) MoveAfterConquest(color Color, count int) error {
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	pc := g.PendingConquest
	if pc == nil {
		return fmt.Errorf("no hay ninguna conquista pendiente")
	}
	if count < 1 || count > pc.Max {
		return fmt.Errorf("podés pasar entre 1 y %d ejércitos", pc.Max)
	}

	extra := count - 1
	from, to := g.Countries[pc.From], g.Countries[pc.To]
	from.Armies -= extra
	to.Armies += extra
	to.MovedThisTurn += extra
	g.PendingConquest = nil

	g.AddLog(fmt.Sprintf("%s pasó %d ejército(s) a %s.", g.CurrentPlayer().Name, count, CountriesData[pc.To].Name))
	return nil
}

func (g *GameBoard) requireNoPendingConquest() error {
	if pc := g.PendingConquest; pc != nil {
		return fmt.Errorf("primero indicá cuántos ejércitos pasás a %s", CountriesData[pc.To].Name)
	}
	return nil
}

// PassTurnToRearrange advances from Attack phase to Rearrange phase
func (g *GameBoard) PassToRearrange(color Color) error {
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseAttack {
		return fmt.Errorf("fase incorrecta")
	}
	if err := g.requireNoPendingConquest(); err != nil {
		return err
	}
	g.CurrentPhase = PhaseRearrange

	// Lo que se puede mover se calcula al inicio del reagrupe: cada país puede
	// mover todos sus ejércitos menos 1 (incluidos los que entraron conquistando).
	// Solo los que lleguen durante el reagrupe quedan fijos.
	for _, c := range g.Countries {
		c.MovedThisTurn = 0
	}
	g.AddLog(fmt.Sprintf("%s pasa a la fase de reagrupar tropas.", g.CurrentPlayer().Name))
	return nil
}

// RearrangeTroops moves armies between friendly neighboring countries
func (g *GameBoard) RearrangeTroops(color Color, fromID, toID, count int) error {
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseRearrange {
		return fmt.Errorf("no estás en fase de reagrupar")
	}

	from := g.Countries[fromID]
	to := g.Countries[toID]

	if from == nil || from.Owner != color || to == nil || to.Owner != color {
		return fmt.Errorf("ambos países deben ser propios")
	}
	if !AreNeighbors(fromID, toID) {
		return fmt.Errorf("los países no son limítrofes")
	}
	if count <= 0 || from.Armies-count < 1 {
		return fmt.Errorf("debes dejar al menos 1 tropa en el país de origen")
	}
	if free := from.Armies - 1 - from.MovedThisTurn; count > free {
		return fmt.Errorf("%s solo puede mover %d ejército(s): los que llegaron en este reagrupe no se vuelven a mover",
			CountriesData[fromID].Name, max(free, 0))
	}

	from.Armies -= count
	to.Armies += count
	to.MovedThisTurn += count

	g.AddLog(fmt.Sprintf("%s movió %d tropas de %s a %s.", g.CurrentPlayer().Name, count, CountriesData[fromID].Name, CountriesData[toID].Name))
	return nil
}

// EndTurn finishes player turn, draws a card if conquered, and rotates to next player
func (g *GameBoard) EndTurn(color Color) error {
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseRearrange && g.CurrentPhase != PhaseAttack {
		return fmt.Errorf("no puedes finalizar el turno en esta fase")
	}
	if err := g.requireNoPendingConquest(); err != nil {
		return err
	}

	p := g.CurrentPlayer()

	// Draw country card if conquered at least 1 country this turn and deck has cards
	if p.ConqueredTurn && len(g.CardDeck) > 0 {
		cardID := g.CardDeck[0]
		g.CardDeck = g.CardDeck[1:]
		card := CardState{
			CountryID: cardID,
			Figure:    CountriesData[cardID].Figure,
		}
		g.AddLog(fmt.Sprintf("%s tomó una tarjeta de país.", p.Name))

		// Regla del TEG: si la tarjeta es de un país propio, recibe 2 ejércitos ahí
		if c := g.Countries[cardID]; c != nil && c.Owner == color {
			c.Armies += 2
			card.Cashed = true
			g.AddLog(fmt.Sprintf("La tarjeta es de %s, que es suyo: recibe 2 ejércitos ahí.", CountriesData[cardID].Name))
		}
		p.Cards = append(p.Cards, card)
	}

	// Advance turn to next active player (los eliminados no juegan)
	prev := g.CurrentTurnIndex
	for i := 0; i < len(g.TurnOrder); i++ {
		g.CurrentTurnIndex = (g.CurrentTurnIndex + 1) % len(g.TurnOrder)
		if g.CurrentPlayer().IsAlive {
			break
		}
	}
	nextPlayer := g.CurrentPlayer()
	if g.CurrentTurnIndex <= prev {
		g.Round++
		g.AddLog(fmt.Sprintf("Comienza la ronda %d.", g.Round))
	}

	g.StartTurn(nextPlayer.Color)
	return nil
}

// checkElimination marca como eliminado al defensor que se quedó sin países.
// Como en el TEG, sus tarjetas pasan al jugador que lo eliminó.
func (g *GameBoard) checkElimination(attacker, defender Color) {
	loser := g.Players[defender]
	if loser == nil || !loser.IsAlive {
		return
	}
	for _, c := range g.Countries {
		if c.Owner == defender {
			return
		}
	}

	loser.IsAlive = false
	loser.TroopsToPlace = 0
	winner := g.Players[attacker]
	winner.Cards = append(winner.Cards, loser.Cards...)
	loser.Cards = nil
	g.AddLog(fmt.Sprintf("¡%s fue eliminado por %s!", loser.Name, winner.Name))
}

// CheckVictory checks if player achieved their secret mission or 30 countries
func (g *GameBoard) CheckVictory(color Color) bool {
	p := g.Players[color]
	if p == nil {
		return false
	}

	ownedCount := 0
	for _, c := range g.Countries {
		if c.Owner == color {
			ownedCount++
		}
	}

	// Último jugador en pie
	alive := 0
	for _, other := range g.Players {
		if other.IsAlive {
			alive++
		}
	}
	if alive == 1 && p.IsAlive {
		g.Winner = color
		g.CurrentPhase = PhaseFinished
		g.AddLog(fmt.Sprintf("¡¡¡%s HA ELIMINADO A TODOS SUS RIVALES Y GANÓ LA PARTIDA!!!", p.Name))
		return true
	}

	// Global victory: 30 countries
	if ownedCount >= 30 {
		g.Winner = color
		g.CurrentPhase = PhaseFinished
		g.AddLog(fmt.Sprintf("¡¡¡%s HA GANADO LA PARTIDA CONQUISTANDO 30 PAÍSES!!!", p.Name))
		return true
	}

	// Mission checking
	switch p.Mission.ID {
	case 1: // Asia (15) + 2 América del Sur
		if g.OwnsContinent(color, ContinentAsia) && g.CountOwnedInContinent(color, ContinentSouthAmerica) >= 2 {
			g.Winner = color
			g.CurrentPhase = PhaseFinished
			g.AddLog(fmt.Sprintf("¡¡¡%s HA CUMPLIDO SU MISIÓN Y GANÓ LA PARTIDA!!!", p.Name))
			return true
		}
	case 9:
		if ownedCount >= 30 {
			g.Winner = color
			g.CurrentPhase = PhaseFinished
			g.AddLog(fmt.Sprintf("¡¡¡%s HA CUMPLIDO SU MISIÓN Y GANÓ LA PARTIDA!!!", p.Name))
			return true
		}
	}

	return false
}

func (g *GameBoard) OwnsContinent(color Color, contID ContinentID) bool {
	contDef := ContinentsData[contID]
	for _, cID := range contDef.Countries {
		if g.Countries[cID].Owner != color {
			return false
		}
	}
	return true
}

func (g *GameBoard) CountOwnedInContinent(color Color, contID ContinentID) int {
	count := 0
	contDef := ContinentsData[contID]
	for _, cID := range contDef.Countries {
		if g.Countries[cID].Owner == color {
			count++
		}
	}
	return count
}
