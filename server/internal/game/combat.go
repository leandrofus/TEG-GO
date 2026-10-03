package game

import (
	"math/rand"
	"sort"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

type CombatResult struct {
	AttackerDice    []int `json:"attackerDice"`
	DefenderDice    []int `json:"defenderDice"`
	AttackerLosses  int   `json:"attackerLosses"`
	DefenderLosses  int   `json:"defenderLosses"`
	Conquered       bool  `json:"conquered"`
	FromCountryID   int   `json:"fromCountryId"`
	ToCountryID     int   `json:"toCountryId"`
	Attacker        Color `json:"attacker"`
	Defender        Color `json:"defender"`
}

// RollDice rolls n random 6-sided dice and sorts them descending
func RollDice(count int) []int {
	dice := make([]int, count)
	for i := 0; i < count; i++ {
		dice[i] = rand.Intn(6) + 1
	}
	sort.Slice(dice, func(i, j int) bool {
		return dice[i] > dice[j]
	})
	return dice
}

// ExecuteAttack performs combat resolution between attacker and defender countries
func ExecuteAttack(from *CountryState, to *CountryState) CombatResult {
	// Max attacker dice = min(3, from.Armies - 1)
	defender := to.Owner

	numAttackerDice := from.Armies - 1
	if numAttackerDice > 3 {
		numAttackerDice = 3
	}

	// Max defender dice = min(3, to.Armies)
	numDefenderDice := to.Armies
	if numDefenderDice > 3 {
		numDefenderDice = 3
	}

	atkDice := RollDice(numAttackerDice)
	defDice := RollDice(numDefenderDice)

	pairs := len(atkDice)
	if len(defDice) < pairs {
		pairs = len(defDice)
	}

	atkLosses := 0
	defLosses := 0

	for i := 0; i < pairs; i++ {
		if defDice[i] >= atkDice[i] {
			// Defender wins ties
			atkLosses++
		} else {
			defLosses++
		}
	}

	from.Armies -= atkLosses
	to.Armies -= defLosses

	conquered := false
	if to.Armies <= 0 {
		conquered = true
		to.Owner = from.Owner
		// Pasa 1 ejército obligatorio; el atacante decide después si pasa más
		// (ver GameBoard.MoveAfterConquest)
		to.Armies = 1
		from.Armies -= 1
		to.MovedThisTurn = 1
	}

	return CombatResult{
		AttackerDice:   atkDice,
		DefenderDice:   defDice,
		AttackerLosses: atkLosses,
		DefenderLosses: defLosses,
		Conquered:      conquered,
		FromCountryID:  from.ID,
		ToCountryID:    to.ID,
		Attacker:       from.Owner,
		Defender:       defender,
	}
}
