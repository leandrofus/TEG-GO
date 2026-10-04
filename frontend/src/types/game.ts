export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'black' | 'magenta';

export const COLOR_CONFIG: Record<Color, { name: string; bg: string; border: string; text: string; hex: string }> = {
  red: { name: 'Rojo', bg: 'bg-red-600', border: 'border-red-400', text: 'text-red-400', hex: '#dc2626' },
  yellow: { name: 'Amarillo', bg: 'bg-amber-400', border: 'border-amber-300', text: 'text-amber-400', hex: '#facc15' },
  green: { name: 'Verde', bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-emerald-400', hex: '#059669' },
  blue: { name: 'Azul', bg: 'bg-blue-600', border: 'border-blue-400', text: 'text-blue-400', hex: '#2563eb' },
  black: { name: 'Negro', bg: 'bg-slate-800', border: 'border-slate-500', text: 'text-slate-300', hex: '#334155' },
  magenta: { name: 'Magenta', bg: 'bg-fuchsia-600', border: 'border-fuchsia-400', text: 'text-fuchsia-400', hex: '#c026d3' },
};

// Colores de continente para la vista "Continentes" (inspirados en el tablero clásico)
export const CONTINENT_COLORS: Record<string, string> = {
  'América del Norte': '#d97757',
  'América del Sur': '#8fae7e',
  Europa: '#9b8ad0',
  África: '#c9a15b',
  Asia: '#7f9bb3',
  Oceanía: '#4fb0a8',
};

// Figuras de las tarjetas de país
export const FIGURE_LABELS: Record<string, string> = {
  cannon: '💣 Cañón',
  balloon: '🎈 Globo',
  ship: '⛵ Barco',
  wildcard: '⭐ Comodín',
};

export type Phase =
  | 'lobby'
  | 'initial_placement_1'
  | 'initial_placement_2'
  | 'trade_cards'
  | 'add_armies'
  | 'attack'
  | 'rearrange'
  | 'finished';

export interface CountryDef {
  id: number;
  name: string;
  continent: string;
  borders: number[];
  figure: string;
}

export interface CountryState {
  id: number;
  owner: Color;
  armies: number;
  movedThisTurn: number;
}

export interface MissionDef {
  id: number;
  title: string;
  description: string;
  type: string;
}

export interface CardState {
  countryId: number;
  figure: string;
  cashed: boolean;
}

export interface PlayerState {
  color: Color;
  name: string;
  isBot: boolean;
  isHost: boolean;
  isAlive: boolean;
  mission: MissionDef;
  cards: CardState[];
  tradeCount: number;
  conqueredTurn: boolean;
  troopsToPlace: number;
  troopBonusMap: Record<string, number>;
}

export interface GameBoard {
  countries: Record<number, CountryState>;
  players: Record<Color, PlayerState>;
  turnOrder: Color[];
  currentTurnIndex: number;
  currentPhase: Phase;
  cardDeck: number[];
  winner?: Color;
  logs: string[];
  // Conquista recién hecha: el atacante elige cuántos ejércitos pasa (1 a max)
  pendingConquest?: PendingConquest;
}

export interface PendingConquest {
  from: number;
  to: number;
  max: number;
}

export interface CombatResultData {
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
  fromCountryId: number;
  toCountryId: number;
  attacker: Color;
  defender: Color;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

// Un lugar de la sala, tal como lo manda el server
export interface SeatView {
  color: Color;
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
}

// Quién soy en la sala actual
export interface YouView {
  role: 'player' | 'spectator';
  color?: Color;
  isHost: boolean;
}

export interface RoomState {
  code: string;
  name: string;
  status: RoomStatus;
  started: boolean;
  maxPlayers: number;
  private: boolean;
  seats: SeatView[];
  spectators: number;
  waitingFor: string[] | null;
  you: YouView;
  board?: GameBoard;
}

// Fila del navegador de partidas
export interface RoomSummary {
  code: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
  status: RoomStatus;
  paused: boolean;
  private: boolean;
  spectators: number;
  createdAt: string;
  seats: SeatView[];
  mine: boolean;
  // Soy el anfitrión y no quedan otros jugadores humanos
  canDelete: boolean;
}

export interface Me {
  id: number;
  name: string;
  guest: boolean;
}
