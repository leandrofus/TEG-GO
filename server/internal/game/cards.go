package game

import "fmt"

// TradeBonus Returns the number of armies awarded for the n-th trade (1-indexed)
func GetTradeBonus(tradeCount int) int {
	switch tradeCount {
	case 1:
		return 4
	case 2:
		return 7
	case 3:
		return 10
	case 4:
		return 15
	case 5:
		return 20
	default:
		if tradeCount > 5 {
			return 20 + (tradeCount-5)*5
		}
		return 0
	}
}

// IsValidTradeSet checks if 3 card states form a valid TEG trade set
func IsValidTradeSet(c1, c2, c3 CardState) bool {
	f1, f2, f3 := c1.Figure, c2.Figure, c3.Figure

	// Check wildcards
	wildcards := 0
	if f1 == FigureWildcard {
		wildcards++
	}
	if f2 == FigureWildcard {
		wildcards++
	}
	if f3 == FigureWildcard {
		wildcards++
	}

	if wildcards >= 1 {
		return true // Any set with a wildcard is valid
	}

	// 3 of the same figure
	if f1 == f2 && f2 == f3 {
		return true
	}

	// 3 all different figures
	if f1 != f2 && f2 != f3 && f1 != f3 {
		return true
	}

	return false
}

// CashCard claims +2 armies on a country owned by player if they hold its card and haven't cashed it yet
func (g *GameBoard) CashCard(color Color, countryID int) error {
	p := g.Players[color]
	if p == nil {
		return fmt.Errorf("jugador no encontrado")
	}
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}

	c := g.Countries[countryID]
	if c == nil || c.Owner != color {
		return fmt.Errorf("el país no te pertenece")
	}

	// Find the card in player's inventory
	foundIdx := -1
	for idx, card := range p.Cards {
		if card.CountryID == countryID {
			if card.Cashed {
				return fmt.Errorf("esta tarjeta ya fue cobrada")
			}
			foundIdx = idx
			break
		}
	}

	if foundIdx == -1 {
		return fmt.Errorf("no posees la tarjeta de este país")
	}

	// Mark card as cashed and add +2 armies to country
	p.Cards[foundIdx].Cashed = true
	c.Armies += 2

	g.AddLog(fmt.Sprintf("%s cobró la tarjeta de %s y recibió 2 ejércitos en el país.", p.Name, CountriesData[countryID].Name))
	return nil
}

// TradeCards exchanges 3 cards for additional turn armies
func (g *GameBoard) TradeCards(color Color, cardIDs []int) error {
	p := g.Players[color]
	if p == nil {
		return fmt.Errorf("jugador no encontrado")
	}
	if g.TurnOrder[g.CurrentTurnIndex] != color {
		return fmt.Errorf("no es tu turno")
	}
	if g.CurrentPhase != PhaseTradeCards {
		return fmt.Errorf("solo podés canjear tarjetas al comienzo del turno")
	}
	if len(cardIDs) != 3 {
		return fmt.Errorf("debes seleccionar exactamente 3 tarjetas")
	}

	// Retrieve cards
	selectedCards := make([]CardState, 0, 3)
	selectedIndices := make([]int, 0, 3)

	for _, id := range cardIDs {
		found := false
		for idx, card := range p.Cards {
			if card.CountryID == id {
				selectedCards = append(selectedCards, card)
				selectedIndices = append(selectedIndices, idx)
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("no posees la tarjeta ID %d", id)
		}
	}

	if !IsValidTradeSet(selectedCards[0], selectedCards[1], selectedCards[2]) {
		return fmt.Errorf("las 3 tarjetas seleccionadas no forman una combinación válida (deben ser 3 iguales, 3 distintas o con comodín)")
	}

	// Remove traded cards from player inventory and return to deck
	newCards := make([]CardState, 0)
	for _, card := range p.Cards {
		isTraded := false
		for _, selectedID := range cardIDs {
			if card.CountryID == selectedID {
				isTraded = true
				break
			}
		}
		if !isTraded {
			newCards = append(newCards, card)
		} else {
			g.CardDeck = append(g.CardDeck, card.CountryID)
		}
	}
	p.Cards = newCards

	// Increase trade count and award bonus armies
	p.TradeCount++
	bonusArmies := GetTradeBonus(p.TradeCount)
	p.TroopsToPlace += bonusArmies

	g.AddLog(fmt.Sprintf("¡%s realizó el canje #%d y recibió %d ejércitos extra!", p.Name, p.TradeCount, bonusArmies))
	return nil
}
