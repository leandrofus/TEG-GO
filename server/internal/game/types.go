package game

// Color represents a player color in TEG
type Color string

const (
	ColorRed    Color = "red"
	ColorYellow Color = "yellow"
	ColorGreen  Color = "green"
	ColorBlue   Color = "blue"
	ColorBlack  Color = "black"
	ColorMagenta Color = "magenta"
)

var AllColors = []Color{ColorRed, ColorYellow, ColorGreen, ColorBlue, ColorBlack, ColorMagenta}

// ContinentID represents continent identifier
type ContinentID string

const (
	ContinentNorthAmerica ContinentID = "NorthAmerica"
	ContinentSouthAmerica ContinentID = "SouthAmerica"
	ContinentEurope       ContinentID = "Europe"
	ContinentAfrica       ContinentID = "Africa"
	ContinentAsia         ContinentID = "Asia"
	ContinentOceania      ContinentID = "Oceania"
)

// Figure represents the symbol on a country card
type Figure string

const (
	FigureCannon   Figure = "cannon"
	FigureBalloon  Figure = "balloon"
	FigureShip     Figure = "ship"
	FigureWildcard Figure = "wildcard"
)

// CountryDef defines static country properties
type CountryDef struct {
	ID        int         `json:"id"`
	Name      string      `json:"name"`
	Continent ContinentID `json:"continent"`
	Borders   []int       `json:"borders"`
	Figure    Figure      `json:"figure"`
}

// ContinentDef defines continent bonus rules
type ContinentDef struct {
	ID         ContinentID `json:"id"`
	Name       string      `json:"name"`
	BonusTroops int        `json:"bonusTroops"`
	Countries  []int       `json:"countries"`
}

// CountryState defines dynamic state of a country in a game
type CountryState struct {
	ID       int   `json:"id"`
	Owner    Color `json:"owner"`
	Armies   int   `json:"armies"`
	MovedThisTurn int `json:"movedThisTurn"` // Armies that cannot move again this turn
}

// CardState represents a country card held by a player
type CardState struct {
	CountryID int    `json:"countryId"`
	Figure    Figure `json:"figure"`
	Cashed    bool   `json:"cashed"` // Whether +2 troops were claimed for owning the country
}

// MissionDef defines win conditions
type MissionType string

const (
	MissionTypeConquer    MissionType = "conquer"
	MissionTypeDestruction MissionType = "destruction"
	MissionTypeGlobal      MissionType = "global"
)

type MissionDef struct {
	ID          int         `json:"id"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Type        MissionType `json:"type"`
	TargetColor Color       `json:"targetColor,omitempty"` // For destruction missions
}
