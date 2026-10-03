package game

import (
	"fmt"
	"math/rand"
)

type PlayerState struct {
	Color          Color          `json:"color"`
	Name           string         `json:"name"`
	IsBot          bool           `json:"isBot"`
	IsHost         bool           `json:"isHost"`
	IsAlive        bool           `json:"isAlive"`
	Mission        MissionDef     `json:"mission"`
	Cards          []CardState    `json:"cards"`
	TradeCount     int            `json:"tradeCount"`     // Number of trades made (determines trade bonus)
	ConqueredTurn  bool           `json:"conqueredTurn"`  // Whether player conquered at least 1 country this turn
	TroopsToPlace  int            `json:"troopsToPlace"`  // Remaining armies to add in placement phase
	TroopBonusMap  map[string]int `json:"troopBonusMap"` // Breakdown of bonus armies (base, continents, cards)
}

type Phase string

const (
	PhaseLobby             Phase = "lobby"
	PhaseInitialPlacement1 Phase = "initial_placement_1" // First round: place 5 armies
	PhaseInitialPlacement2 Phase = "initial_placement_2" // Second round: place 3 armies
	PhaseTradeCards        Phase = "trade_cards"         // Card trading before adding armies
	PhaseAddArmies         Phase = "add_armies"          // Adding turn armies (base + continent bonus + card bonus)
	PhaseAttack            Phase = "attack"              // Attacking neighboring countries
	PhaseRearrange         Phase = "rearrange"           // Moving armies between friendly countries
	PhaseFinished          Phase = "finished"
)

type GameBoard struct {
	Countries        map[int]*CountryState  `json:"countries"`
	Players          map[Color]*PlayerState `json:"players"`
	TurnOrder        []Color                `json:"turnOrder"`
	CurrentTurnIndex int                    `json:"currentTurnIndex"`
	CurrentPhase     Phase                  `json:"currentPhase"`
	CardDeck         []int                  `json:"cardDeck"` // Country IDs remaining in deck
	Winner           Color                  `json:"winner,omitempty"`
	PendingConquest  *PendingConquest       `json:"pendingConquest,omitempty"`
	Logs             []string               `json:"logs"`
}

// PendingConquest es una conquista recién hecha en la que el atacante todavía
// tiene que decidir cuántos ejércitos pasa al país conquistado (1 a Max).
type PendingConquest struct {
	From int `json:"from"`
	To   int `json:"to"`
	Max  int `json:"max"`
}

// NewGameBoard initializes a game with 50 countries distributed among players
func NewGameBoard(players map[Color]*PlayerState, turnOrder []Color) *GameBoard {
	board := &GameBoard{
		Countries:        make(map[int]*CountryState),
		Players:          players,
		TurnOrder:        turnOrder,
		CurrentTurnIndex: 0,
		CurrentPhase:     PhaseInitialPlacement1,
		CardDeck:         make([]int, 0, 50),
		Logs:             make([]string, 0),
	}

	// Shuffle card deck
	for id := 1; id <= 50; id++ {
		board.CardDeck = append(board.CardDeck, id)
	}
	rand.Shuffle(len(board.CardDeck), func(i, j int) {
		board.CardDeck[i], board.CardDeck[j] = board.CardDeck[j], board.CardDeck[i]
	})

	// Randomly distribute all 50 countries among active players
	shuffledCountries := make([]int, 50)
	for i := 0; i < 50; i++ {
		shuffledCountries[i] = i + 1
	}
	rand.Shuffle(len(shuffledCountries), func(i, j int) {
		shuffledCountries[i], shuffledCountries[j] = shuffledCountries[j], shuffledCountries[i]
	})

	numPlayers := len(turnOrder)
	for idx, countryID := range shuffledCountries {
		assignedColor := turnOrder[idx%numPlayers]
		board.Countries[countryID] = &CountryState{
			ID:     countryID,
			Owner:  assignedColor,
			Armies: 1, // Every country starts with 1 army
		}
	}

	// Assign 5 initial armies for placement round 1
	for _, p := range board.Players {
		p.TroopsToPlace = 5
		p.IsAlive = true
		p.Cards = make([]CardState, 0)
		p.TroopBonusMap = make(map[string]int)
	}

	board.AddLog("¡La partida ha comenzado! Países repartidos.")
	board.AddLog(fmt.Sprintf("Turno de %s para colocar sus primeros 5 ejércitos.", board.CurrentPlayer().Name))

	return board
}

func (g *GameBoard) CurrentPlayer() *PlayerState {
	if len(g.TurnOrder) == 0 {
		return nil
	}
	color := g.TurnOrder[g.CurrentTurnIndex]
	return g.Players[color]
}

func (g *GameBoard) AddLog(msg string) {
	g.Logs = append(g.Logs, msg)
	if len(g.Logs) > 100 {
		g.Logs = g.Logs[len(g.Logs)-100:]
	}
}

// CalculateTroopBonus computes how many armies a player gets at the start of their turn
func (g *GameBoard) CalculateTroopBonus(color Color) (int, map[string]int) {
	breakdown := make(map[string]int)

	// 1. Base bonus: Floor(Total owned countries / 2), minimum 3
	ownedCount := 0
	for _, c := range g.Countries {
		if c.Owner == color {
			ownedCount++
		}
	}
	base := ownedCount / 2
	if base < 3 {
		base = 3
	}
	breakdown["Base (Países)"] = base
	total := base

	// 2. Continent bonuses
	for _, contDef := range ContinentsData {
		allOwned := true
		for _, cID := range contDef.Countries {
			if g.Countries[cID].Owner != color {
				allOwned = false
				break
			}
		}
		if allOwned {
			breakdown[contDef.Name] = contDef.BonusTroops
			total += contDef.BonusTroops
		}
	}

	return total, breakdown
}

// AreNeighbors checks if country A and country B are border adjacent
func AreNeighbors(idA, idB int) bool {
	cDef, exists := CountriesData[idA]
	if !exists {
		return false
	}
	for _, b := range cDef.Borders {
		if b == idB {
			return true
		}
	}
	return false
}

// ViewFor devuelve una copia del tablero para mostrarle a un jugador (o a un
// espectador, con viewer vacío): las misiones y las tarjetas de los demás
// quedan ocultas. Solo se copia lo que cambia; el resto se comparte.
func (g *GameBoard) ViewFor(viewer Color) *GameBoard {
	view := *g
	view.Players = make(map[Color]*PlayerState, len(g.Players))
	for color, p := range g.Players {
		if color == viewer {
			view.Players[color] = p
			continue
		}
		hidden := *p
		hidden.Mission = MissionDef{}
		hidden.Cards = make([]CardState, len(p.Cards))
		for i, c := range p.Cards {
			hidden.Cards[i] = CardState{Cashed: c.Cashed}
		}
		view.Players[color] = &hidden
	}
	view.CardDeck = nil
	return &view
}

// ShuffledMissions devuelve las misiones secretas en orden aleatorio.
func ShuffledMissions() []MissionDef {
	out := append([]MissionDef(nil), SecretMissions...)
	rand.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

// ShuffleColors sortea el orden de los turnos.
func ShuffleColors(order []Color) {
	rand.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
}
