package bot

import (
	"fmt"
	"math"

	"teg-server/internal/game"
)

type BotStyle string

const (
	StyleAggressive BotStyle = "aggressive"
	StyleBalanced   BotStyle = "balanced"
	StyleDefensive  BotStyle = "defensive"
)

type BotRunner struct {
	Color game.Color
	Style BotStyle
	// Resultado del ataque hecho en el último paso, para avisarle a los jugadores
	LastCombat *game.CombatResult
}

func NewBotRunner(color game.Color) *BotRunner {
	return &BotRunner{
		Color: color,
		Style: StyleBalanced,
	}
}

// EvaluateCountryValue computes the heuristic score of a country for the bot
func (b *BotRunner) EvaluateCountryValue(board *game.GameBoard, countryID int) float64 {
	score := 1.0
	p := board.Players[b.Color]
	if p == nil {
		return score
	}

	cDef := game.CountriesData[countryID]

	// 1. Mission Heuristic: V = P^2 * Km
	// Km constant = 5.0
	missionProgress := b.calculateMissionProgress(board)
	if b.isCountryInMission(p.Mission, countryID) {
		score += math.Pow(missionProgress, 2) * 5.0
	}

	// 2. Continent Heuristic: V = P^2 * Kc * B
	// Kc constant = 3.0, B = bonus troops
	contDef := game.ContinentsData[cDef.Continent]
	contProgress := b.calculateContinentProgress(board, cDef.Continent)
	score += math.Pow(contProgress, 2) * 3.0 * float64(contDef.BonusTroops)

	return score
}

func (b *BotRunner) calculateMissionProgress(board *game.GameBoard) float64 {
	ownedCount := 0
	for _, c := range board.Countries {
		if c.Owner == b.Color {
			ownedCount++
		}
	}
	// Cap at 30 countries for global objective
	progress := float64(ownedCount) / 30.0
	if progress > 1.0 {
		progress = 1.0
	}
	return progress
}

func (b *BotRunner) calculateContinentProgress(board *game.GameBoard, contID game.ContinentID) float64 {
	contDef := game.ContinentsData[contID]
	owned := 0
	for _, cID := range contDef.Countries {
		if board.Countries[cID].Owner == b.Color {
			owned++
		}
	}
	return float64(owned) / float64(len(contDef.Countries))
}

func (b *BotRunner) isCountryInMission(mission game.MissionDef, countryID int) bool {
	cDef := game.CountriesData[countryID]
	switch mission.ID {
	case 1: // Asia + América del Sur
		return cDef.Continent == game.ContinentAsia || cDef.Continent == game.ContinentSouthAmerica
	case 2: // América del Sur + Europa
		return cDef.Continent == game.ContinentSouthAmerica || cDef.Continent == game.ContinentEurope
	case 3: // América del Sur + África + Asia
		return cDef.Continent == game.ContinentSouthAmerica || cDef.Continent == game.ContinentAfrica || cDef.Continent == game.ContinentAsia
	default:
		return true
	}
}

// TakeStep performs one tactical move for the bot player
func (b *BotRunner) TakeStep(board *game.GameBoard) bool {
	if board.CurrentPhase == game.PhaseFinished {
		return false
	}
	p := board.CurrentPlayer()
	if p == nil || p.Color != b.Color || !p.IsBot {
		return false
	}

	// Tras conquistar, el bot pasa todos los ejércitos que puede
	if pc := board.PendingConquest; pc != nil {
		return board.MoveAfterConquest(b.Color, pc.Max) == nil
	}

	switch board.CurrentPhase {
	case game.PhaseInitialPlacement1, game.PhaseInitialPlacement2:
		return b.stepPlacement(board)
	case game.PhaseAddArmies:
		if p.TroopsToPlace <= 0 {
			board.AdvancePhaseAfterPlacement()
			return true
		}
		return b.stepPlacement(board)
	case game.PhaseTradeCards:
		// Canjea si tiene una combinación válida; si no, sigue
		if ids := findTradeSet(board.CurrentPlayer().Cards); ids != nil && board.TradeCards(b.Color, ids) == nil {
			return true
		}
		board.SkipTrade(b.Color)
		return true
	case game.PhaseAttack:
		return b.stepAttack(board)
	case game.PhaseRearrange:
		return b.stepRearrange(board)
	}

	return false
}

func (b *BotRunner) stepPlacement(board *game.GameBoard) bool {
	p := board.CurrentPlayer()
	if p.TroopsToPlace <= 0 {
		return false
	}

	bestCountryID := -1
	bestScore := -1000.0

	for _, c := range board.Countries {
		if c.Owner == b.Color {
			score := b.EvaluateCountryValue(board, c.ID)
			// Factor in enemy neighbors (opportunity & risk)
			cDef := game.CountriesData[c.ID]
			enemyNeighbors := 0
			for _, nID := range cDef.Borders {
				if board.Countries[nID].Owner != b.Color {
					enemyNeighbors++
				}
			}
			score += float64(enemyNeighbors) * 2.0

			if score > bestScore {
				bestScore = score
				bestCountryID = c.ID
			}
		}
	}

	if bestCountryID != -1 {
		err := board.PlaceTroops(b.Color, bestCountryID, 1)
		if err != nil {
			fmt.Printf("Bot placement error: %v\n", err)
			return false
		}
		return true
	}
	return false
}

func (b *BotRunner) stepAttack(board *game.GameBoard) bool {
	type attackOption struct {
		fromID int
		toID   int
		score  float64
	}

	var bestOpt *attackOption
	// Threshold based on bot style: aggressive = 0.5, balanced = 1.0, defensive = 2.0
	threshold := 1.0
	if b.Style == StyleAggressive {
		threshold = 0.5
	} else if b.Style == StyleDefensive {
		threshold = 2.0
	}

	for _, from := range board.Countries {
		if from.Owner == b.Color && from.Armies > 1 {
			cDef := game.CountriesData[from.ID]
			for _, toID := range cDef.Borders {
				to := board.Countries[toID]
				if to.Owner != b.Color {
					diff := float64(from.Armies - to.Armies)
					targetValue := b.EvaluateCountryValue(board, toID)
					score := diff * targetValue

					if diff >= threshold {
						if bestOpt == nil || score > bestOpt.score {
							bestOpt = &attackOption{
								fromID: from.ID,
								toID:   to.ID,
								score:  score,
							}
						}
					}
				}
			}
		}
	}

	if bestOpt != nil {
		res, err := board.PerformAttack(b.Color, bestOpt.fromID, bestOpt.toID)
		b.LastCombat = res
		if err != nil {
			board.PassToRearrange(b.Color)
			return true
		}
		return true
	}

	// No good attacks left, pass to rearrange
	board.PassToRearrange(b.Color)
	return true
}

// stepRearrange lleva los ejércitos de los países interiores hacia el frente:
// cada paso mueve las tropas libres de un país a un vecino propio más cercano a
// un enemigo. Cuando no queda nada útil para mover, termina el turno.
func (b *BotRunner) stepRearrange(board *game.GameBoard) bool {
	dist := b.distanceToEnemy(board)

	for id, c := range board.Countries {
		// Las tropas que llegaron este turno no se vuelven a mover
		free := c.Armies - 1 - c.MovedThisTurn
		if c.Owner != b.Color || free <= 0 || dist[id] <= 1 {
			continue
		}
		for _, nID := range game.CountriesData[id].Borders {
			if board.Countries[nID].Owner == b.Color && dist[nID] < dist[id] {
				if err := board.RearrangeTroops(b.Color, id, nID, free); err == nil {
					return true
				}
			}
		}
	}

	board.EndTurn(b.Color)
	return true
}

// findTradeSet busca 3 tarjetas que formen un canje válido.
func findTradeSet(cards []game.CardState) []int {
	for i := 0; i < len(cards); i++ {
		for j := i + 1; j < len(cards); j++ {
			for k := j + 1; k < len(cards); k++ {
				if game.IsValidTradeSet(cards[i], cards[j], cards[k]) {
					return []int{cards[i].CountryID, cards[j].CountryID, cards[k].CountryID}
				}
			}
		}
	}
	return nil
}

// distanceToEnemy devuelve, para cada país propio, cuántos pasos lo separan del
// país enemigo más cercano (1 = está en el frente). Los inalcanzables no aparecen.
func (b *BotRunner) distanceToEnemy(board *game.GameBoard) map[int]int {
	dist := make(map[int]int)
	queue := make([]int, 0, len(board.Countries))
	for id, c := range board.Countries {
		if c.Owner != b.Color {
			dist[id] = 0
			queue = append(queue, id)
		}
	}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		for _, nID := range game.CountriesData[id].Borders {
			if _, seen := dist[nID]; !seen {
				dist[nID] = dist[id] + 1
				queue = append(queue, nID)
			}
		}
	}
	return dist
}
