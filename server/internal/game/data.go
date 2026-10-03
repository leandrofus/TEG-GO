package game

// Static dataset for TEG (Plan Táctico y Estratégico de la Guerra)

var ContinentsData = map[ContinentID]ContinentDef{
	ContinentNorthAmerica: {
		ID:          ContinentNorthAmerica,
		Name:        "América del Norte",
		BonusTroops: 5,
		Countries:   []int{7, 8, 9, 10, 11, 12, 13, 14, 15, 16},
	},
	ContinentSouthAmerica: {
		ID:          ContinentSouthAmerica,
		Name:        "América del Sur",
		BonusTroops: 3,
		Countries:   []int{1, 2, 3, 4, 5, 6},
	},
	ContinentEurope: {
		ID:          ContinentEurope,
		Name:        "Europa",
		BonusTroops: 5,
		Countries:   []int{17, 18, 19, 20, 21, 22, 23, 24, 25},
	},
	ContinentAfrica: {
		ID:          ContinentAfrica,
		Name:        "África",
		BonusTroops: 3,
		Countries:   []int{41, 42, 43, 44, 45, 46},
	},
	ContinentAsia: {
		ID:          ContinentAsia,
		Name:        "Asia",
		BonusTroops: 7,
		Countries:   []int{26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40},
	},
	ContinentOceania: {
		ID:          ContinentOceania,
		Name:        "Oceanía",
		BonusTroops: 2,
		Countries:   []int{47, 48, 49, 50},
	},
}

var CountriesData = map[int]CountryDef{
	// América del Sur (1 - 6)
	1: {ID: 1, Name: "Argentina", Continent: ContinentSouthAmerica, Borders: []int{2, 3, 4, 6}, Figure: FigureWildcard},
	2: {ID: 2, Name: "Brasil", Continent: ContinentSouthAmerica, Borders: []int{1, 3, 5, 6, 41}, Figure: FigureShip},
	3: {ID: 3, Name: "Uruguay", Continent: ContinentSouthAmerica, Borders: []int{1, 2}, Figure: FigureBalloon},
	4: {ID: 4, Name: "Chile", Continent: ContinentSouthAmerica, Borders: []int{1, 6, 50}, Figure: FigureBalloon},
	5: {ID: 5, Name: "Colombia", Continent: ContinentSouthAmerica, Borders: []int{2, 6, 7}, Figure: FigureBalloon},
	6: {ID: 6, Name: "Perú", Continent: ContinentSouthAmerica, Borders: []int{1, 2, 4, 5}, Figure: FigureShip},

	// América del Norte (7 - 16)
	7:  {ID: 7, Name: "México", Continent: ContinentNorthAmerica, Borders: []int{5, 8}, Figure: FigureCannon},
	8:  {ID: 8, Name: "California", Continent: ContinentNorthAmerica, Borders: []int{7, 9, 10}, Figure: FigureCannon},
	9:  {ID: 9, Name: "Nueva York", Continent: ContinentNorthAmerica, Borders: []int{8, 10, 11, 15, 16}, Figure: FigureShip},
	10: {ID: 10, Name: "Oregón", Continent: ContinentNorthAmerica, Borders: []int{8, 9, 13, 14, 15}, Figure: FigureCannon},
	11: {ID: 11, Name: "Terranova", Continent: ContinentNorthAmerica, Borders: []int{9, 12, 15}, Figure: FigureCannon},
	12: {ID: 12, Name: "Labrador", Continent: ContinentNorthAmerica, Borders: []int{11, 16}, Figure: FigureCannon},
	13: {ID: 13, Name: "Alaska", Continent: ContinentNorthAmerica, Borders: []int{10, 14, 29}, Figure: FigureShip},
	14: {ID: 14, Name: "Yukón", Continent: ContinentNorthAmerica, Borders: []int{10, 13, 15}, Figure: FigureBalloon},
	15: {ID: 15, Name: "Canadá", Continent: ContinentNorthAmerica, Borders: []int{9, 10, 11, 14}, Figure: FigureCannon},
	16: {ID: 16, Name: "Groenlandia", Continent: ContinentNorthAmerica, Borders: []int{9, 12, 17}, Figure: FigureBalloon},

	// Europa (17 - 25)
	17: {ID: 17, Name: "Islandia", Continent: ContinentEurope, Borders: []int{16, 18, 19}, Figure: FigureShip},
	18: {ID: 18, Name: "Gran Bretaña", Continent: ContinentEurope, Borders: []int{17, 22, 25}, Figure: FigureShip},
	19: {ID: 19, Name: "Suecia", Continent: ContinentEurope, Borders: []int{17, 20}, Figure: FigureShip},
	20: {ID: 20, Name: "Rusia", Continent: ContinentEurope, Borders: []int{19, 21, 26, 31, 36}, Figure: FigureBalloon},
	21: {ID: 21, Name: "Polonia", Continent: ContinentEurope, Borders: []int{20, 22, 36, 42}, Figure: FigureCannon},
	22: {ID: 22, Name: "Alemania", Continent: ContinentEurope, Borders: []int{18, 21, 23, 24}, Figure: FigureShip},
	23: {ID: 23, Name: "Francia", Continent: ContinentEurope, Borders: []int{22, 24, 25}, Figure: FigureBalloon},
	24: {ID: 24, Name: "Italia", Continent: ContinentEurope, Borders: []int{22, 23}, Figure: FigureBalloon},
	25: {ID: 25, Name: "España", Continent: ContinentEurope, Borders: []int{18, 23, 41}, Figure: FigureBalloon},

	// Asia (26 - 40)
	26: {ID: 26, Name: "Aral", Continent: ContinentAsia, Borders: []int{20, 27, 30, 31, 32}, Figure: FigureCannon},
	27: {ID: 27, Name: "Tartaria", Continent: ContinentAsia, Borders: []int{26, 28, 30}, Figure: FigureCannon},
	28: {ID: 28, Name: "Taimir", Continent: ContinentAsia, Borders: []int{27, 30}, Figure: FigureWildcard},
	29: {ID: 29, Name: "Kamchatka", Continent: ContinentAsia, Borders: []int{13, 30, 34, 35}, Figure: FigureBalloon},
	30: {ID: 30, Name: "Siberia", Continent: ContinentAsia, Borders: []int{26, 27, 28, 29, 32, 34}, Figure: FigureShip},
	31: {ID: 31, Name: "Irán", Continent: ContinentAsia, Borders: []int{20, 26, 32, 33, 34, 36, 40}, Figure: FigureBalloon},
	32: {ID: 32, Name: "Mongolia", Continent: ContinentAsia, Borders: []int{26, 30, 31, 33, 34}, Figure: FigureShip},
	33: {ID: 33, Name: "Gobi", Continent: ContinentAsia, Borders: []int{31, 32, 34}, Figure: FigureBalloon},
	34: {ID: 34, Name: "China", Continent: ContinentAsia, Borders: []int{29, 30, 31, 32, 33, 35, 37, 40}, Figure: FigureShip},
	35: {ID: 35, Name: "Japón", Continent: ContinentAsia, Borders: []int{29, 34}, Figure: FigureCannon},
	36: {ID: 36, Name: "Turquía", Continent: ContinentAsia, Borders: []int{20, 21, 31, 38, 39, 42}, Figure: FigureShip},
	37: {ID: 37, Name: "Malasia", Continent: ContinentAsia, Borders: []int{34, 40, 48}, Figure: FigureCannon},
	38: {ID: 38, Name: "Israel", Continent: ContinentAsia, Borders: []int{36, 39, 42}, Figure: FigureShip},
	39: {ID: 39, Name: "Arabia", Continent: ContinentAsia, Borders: []int{36, 38}, Figure: FigureCannon},
	40: {ID: 40, Name: "India", Continent: ContinentAsia, Borders: []int{31, 34, 37, 47}, Figure: FigureBalloon},

	// África (41 - 46)
	41: {ID: 41, Name: "Sahara", Continent: ContinentAfrica, Borders: []int{2, 25, 42, 43, 44}, Figure: FigureCannon},
	42: {ID: 42, Name: "Egipto", Continent: ContinentAfrica, Borders: []int{21, 36, 38, 41, 43, 46}, Figure: FigureBalloon},
	43: {ID: 43, Name: "Etiopía", Continent: ContinentAfrica, Borders: []int{41, 42, 44, 45}, Figure: FigureBalloon},
	44: {ID: 44, Name: "Zaire", Continent: ContinentAfrica, Borders: []int{41, 43, 45, 46}, Figure: FigureShip},
	45: {ID: 45, Name: "Sudáfrica", Continent: ContinentAfrica, Borders: []int{43, 44}, Figure: FigureCannon},
	46: {ID: 46, Name: "Madagascar", Continent: ContinentAfrica, Borders: []int{42, 44}, Figure: FigureShip},

	// Oceanía (47 - 50)
	47: {ID: 47, Name: "Sumatra", Continent: ContinentOceania, Borders: []int{40, 50}, Figure: FigureBalloon},
	48: {ID: 48, Name: "Borneo", Continent: ContinentOceania, Borders: []int{37, 50}, Figure: FigureShip},
	49: {ID: 49, Name: "Java", Continent: ContinentOceania, Borders: []int{50}, Figure: FigureCannon},
	50: {ID: 50, Name: "Australia", Continent: ContinentOceania, Borders: []int{4, 47, 48, 49}, Figure: FigureCannon},
}

var SecretMissions = []MissionDef{
	{ID: 1, Title: "Ocupar Asia y América del Sur", Description: "Ocupar Asia y 2 países de América del Sur.", Type: MissionTypeConquer},
	{ID: 2, Title: "Ocupar América del Sur, Europa y 3 Limítrofes", Description: "Ocupar América del Sur, 7 países de Europa y 3 países limítrofes entre sí en cualquier lugar del mapa.", Type: MissionTypeConquer},
	{ID: 3, Title: "Ocupar América del Sur, África y Asia", Description: "Ocupar América del Sur, África y 4 países de Asia.", Type: MissionTypeConquer},
	{ID: 4, Title: "Ocupar África, América del Norte y Europa", Description: "Ocupar África, 5 países de América del Norte y 4 países de Europa.", Type: MissionTypeConquer},
	{ID: 5, Title: "Ocupar Europa, Asia y América del Sur", Description: "Ocupar Europa, 4 países de Asia y 2 países de América del Sur.", Type: MissionTypeConquer},
	{ID: 6, Title: "Ocupar Oceanía, África y América del Norte", Description: "Ocupar Oceanía, África y 5 países de América del Norte.", Type: MissionTypeConquer},
	{ID: 7, Title: "Ocupar América del Norte, Oceanía y Asia", Description: "Ocupar América del Norte, 2 países de Oceanía y 4 países de Asia.", Type: MissionTypeConquer},
	{ID: 8, Title: "Ocupar Oceanía, América del Norte y Europa", Description: "Ocupar Oceanía, América del Norte y 2 países de Europa.", Type: MissionTypeConquer},
	{ID: 9, Title: "Objetivo General (30 Países)", Description: "Conquistar 30 países cualquiera en el mapa.", Type: MissionTypeGlobal},
}
