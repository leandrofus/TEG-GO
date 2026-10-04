import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomState, CountryDef, CombatResultData, CardState } from '../../types/game';
import { COLOR_CONFIG, PHASE_NAMES } from '../../types/game';
import { wsService } from '../../services/websocket';
import { soundEngine } from '../../services/audio';
import { TegMap } from '../map/TegMap';
import { GameControls } from './GameControls';
import { ContinentBonusPanel } from './ContinentBonusPanel';
import { CardModal } from './CardModal';
import { CombatModal } from './CombatModal';
import { NewCardModal } from './NewCardModal';
import { RulesModal } from './RulesModal';
import { TurnDrawModal } from './TurnDrawModal';
import { TurnOrderPanel } from './TurnOrderPanel';
import { nextAliveIndex } from './turns';
import { useBoardEvents } from './useBoardEvents';
import { Trophy, PauseCircle, Bot, Eye, LogOut, Flag, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GameScreenProps {
  room: RoomState;
  countries: Record<number, CountryDef>;
  notify: (msg: string) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ room, countries, notify }) => {
  const board = room.board!;
  const myColor = room.you.role === 'player' ? room.you.color : undefined;
  const myState = myColor ? board.players[myColor] : null;
  const spectator = room.you.role === 'spectator';
  const waitingFor = room.waitingFor ?? [];
  const paused = waitingFor.length > 0;

  const [selectedFromId, setSelectedFromId] = useState<number | null>(null);
  const [selectedToId, setSelectedToId] = useState<number | null>(null);
  // Último combate propio: se muestra dentro del panel de ataque
  const [lastCombat, setLastCombat] = useState<CombatResultData | null>(null);
  // Combate que se muestra en el modal (propio o de cualquier jugador)
  const [shownCombat, setShownCombat] = useState<CombatResultData | null>(null);
  const closeCombat = useCallback(() => setShownCombat(null), []);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [hoveredContinent, setHoveredContinent] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  const [showDraw, setShowDraw] = useState(false);

  // Tarjetas que acabo de recibir: se detectan comparando con las que tenía
  const myCards = myState?.cards ?? [];
  const cardKey = myCards.map((c) => c.countryId).join(',');
  const [prevCardKey, setPrevCardKey] = useState(cardKey);
  const [newCards, setNewCards] = useState<CardState[]>([]);
  if (cardKey !== prevCardKey) {
    const before = new Set(prevCardKey.split(',').filter(Boolean).map(Number));
    const added = myCards.filter((c) => !before.has(c.countryId));
    setPrevCardKey(cardKey);
    if (added.length > 0) setNewCards(added);
  }
  const events = useBoardEvents();

  const myColorRef = useRef(myColor);
  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);

  useEffect(
    () =>
      wsService.subscribe((payload) => {
        if (payload.type !== 'COMBAT_EVENT') return;
        const res: CombatResultData = payload.combatResult;
        setShownCombat(res);
        if (res.attacker === myColorRef.current) setLastCombat(res);
        soundEngine.playDiceRoll();
        if (res.conquered) setTimeout(() => soundEngine.playConquest(), 400);
      }),
    [],
  );

  // Aviso sonoro al empezar mi turno, y confeti al terminar la partida
  const currentColor = board.turnOrder[board.currentTurnIndex];
  useEffect(() => {
    if (myColor && currentColor === myColor) soundEngine.playTurnChime();
  }, [currentColor, myColor]);
  useEffect(() => {
    if (board.winner) confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  }, [board.winner]);

  // Cartel de "¡Tu turno!" cada vez que me toca (en la colocación inicial cada
  // ronda cuenta como un turno distinto)
  const placing = board.currentPhase.startsWith('initial_placement');
  const myTurnKey = `${board.round}-${board.currentTurnIndex}-${placing ? board.currentPhase : ''}`;
  const [prevMyTurnKey, setPrevMyTurnKey] = useState(myTurnKey);
  const [turnSplash, setTurnSplash] = useState(false);
  if (myTurnKey !== prevMyTurnKey) {
    setPrevMyTurnKey(myTurnKey);
    if (myColor && currentColor === myColor && !board.winner) setTurnSplash(true);
  }
  useEffect(() => {
    if (!turnSplash) return;
    const t = setTimeout(() => setTurnSplash(false), 1800);
    return () => clearTimeout(t);
  }, [turnSplash]);

  const currentPlayer = board.players[currentColor];
  const nextPlayer = board.players[board.turnOrder[nextAliveIndex(board, board.currentTurnIndex)]];

  const clearSelection = () => {
    setSelectedFromId(null);
    setSelectedToId(null);
  };

  // Al cambiar de turno o de fase la selección anterior deja de tener sentido
  const turnKey = `${board.currentTurnIndex}-${board.currentPhase}`;
  const [prevTurnKey, setPrevTurnKey] = useState(turnKey);
  if (turnKey !== prevTurnKey) {
    setPrevTurnKey(turnKey);
    setSelectedFromId(null);
    setSelectedToId(null);
    setLastCombat(null);
  }

  // Si el objetivo pasó a ser propio (lo conquistamos), deja de ser objetivo
  const targetId =
    board.currentPhase === 'attack' && selectedToId && board.countries[selectedToId]?.owner === myColor
      ? null
      : selectedToId;

  // Reglas de selección: solo en tu turno, el origen siempre es propio y un país
  // ajeno solo se elige como objetivo de ataque si limita con el origen.
  const handleSelectCountry = (id: number) => {
    if (!myColor) return;
    if (paused) {
      notify(`Partida en pausa: esperando a ${waitingFor.join(', ')}.`);
      return;
    }
    if (currentColor !== myColor) {
      notify('Esperá tu turno.');
      return;
    }

    const country = board.countries[id];
    const mine = country?.owner === myColor;
    const name = countries[id]?.name ?? 'Ese país';
    const phase = board.currentPhase;

    if (phase === 'initial_placement_1' || phase === 'initial_placement_2' || phase === 'add_armies') {
      if (!mine) {
        notify('Solo podés colocar tropas en tus propios países.');
        return;
      }
      setSelectedFromId(selectedFromId === id ? null : id);
      setSelectedToId(null);
      return;
    }

    if (phase !== 'attack' && phase !== 'rearrange') return;

    if (board.pendingConquest) {
      notify('Primero elegí cuántos ejércitos pasás al país conquistado.');
      return;
    }
    if (id === selectedFromId) {
      clearSelection();
      return;
    }
    if (id === targetId) {
      setSelectedToId(null);
      return;
    }

    const fromNeighbors = selectedFromId ? (countries[selectedFromId]?.borders ?? []) : [];
    const fromName = selectedFromId ? countries[selectedFromId]?.name : '';

    if (mine) {
      // En reagrupar, un vecino propio del origen es el destino
      if (phase === 'rearrange' && selectedFromId && fromNeighbors.includes(id)) {
        setSelectedToId(id);
        return;
      }
      if ((country?.armies ?? 0) < 2) {
        notify(
          phase === 'attack'
            ? `${name} necesita al menos 2 ejércitos para atacar.`
            : `${name} no tiene ejércitos para mover.`,
        );
        return;
      }
      setSelectedFromId(id);
      setSelectedToId(null);
      return;
    }

    if (phase !== 'attack') {
      notify('Solo podés mover tropas entre tus países.');
      return;
    }
    if (!selectedFromId) {
      notify('Primero elegí uno de tus países para atacar desde ahí.');
      return;
    }
    if (!fromNeighbors.includes(id)) {
      notify(`${name} no limita con ${fromName}.`);
      return;
    }
    setSelectedToId(id);
  };

  const abandon = () => {
    if (window.confirm('¿Abandonar la partida? Un bot va a jugar en tu lugar y no vas a poder volver.')) {
      wsService.leaveRoom();
    }
  };

  return (
    <div className="h-full grid grid-cols-4">
      {showCardsModal && myState && (
        <CardModal
          cards={myState.cards || []}
          countries={countries}
          isMyTurn={currentColor === myColor}
          onClose={() => setShowCardsModal(false)}
        />
      )}

      {newCards.length > 0 && (
        <NewCardModal cards={newCards} countries={countries} onClose={() => setNewCards([])} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showDraw && board.turnDraw && (
        <TurnDrawModal draws={board.turnDraw} players={board.players} myColor={myColor} onClose={() => setShowDraw(false)} />
      )}

      {/* Mapa (3/4 del ancho, todo el alto) */}
      <div className="col-span-3 min-h-0 relative">
        {shownCombat && (
          <CombatModal
            combat={shownCombat}
            board={board}
            countries={countries}
            myColor={myColor}
            onClose={closeCombat}
          />
        )}

        {paused && (
          <div className="absolute top-4 inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto bg-slate-950/95 border border-slate-600 rounded-2xl shadow-2xl px-5 py-3 space-y-2 max-w-lg">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                Partida en pausa: esperando a {waitingFor.join(', ')}
              </p>
              {room.you.isHost && (
                <div className="flex flex-wrap gap-2">
                  {room.seats
                    .filter((s) => !s.isBot && !s.connected && waitingFor.includes(s.name))
                    .map((s) => (
                      <button
                        key={s.color}
                        onClick={() => wsService.replaceWithBot(s.color)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-200 border border-slate-600 hover:border-slate-400 rounded-lg px-2.5 py-1.5"
                      >
                        <Bot className="w-3.5 h-3.5" /> Reemplazar a {s.name} por un bot
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Indicador de turno: quién juega, en qué fase y quién sigue */}
        {!board.winner && currentPlayer && (
          <div className="absolute bottom-3 inset-x-0 z-[55] flex justify-center pointer-events-none px-4">
            <div
              className={`flex items-center gap-3 rounded-full border px-4 py-1.5 shadow-2xl bg-slate-950/90 text-sm ${
                currentColor === myColor ? 'border-amber-400 shadow-amber-500/20' : 'border-slate-700'
              }`}
            >
              {board.round > 0 && <span className="text-xs font-bold text-slate-400">Ronda {board.round}</span>}
              <span className="flex items-center gap-1.5 font-extrabold text-white">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLOR_CONFIG[currentColor]?.hex }}
                />
                {currentColor === myColor ? 'Te toca a vos' : `Juega ${currentPlayer.name}`}
              </span>
              <span className="text-xs text-slate-300">{PHASE_NAMES[board.currentPhase]}</span>
              {nextPlayer && nextPlayer.color !== currentColor && (
                <span className="flex items-center gap-1 text-xs text-slate-400 border-l border-slate-700 pl-3">
                  Sigue
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_CONFIG[nextPlayer.color]?.hex }} />
                  <span className="font-bold text-slate-200">
                    {nextPlayer.color === myColor ? 'vos' : nextPlayer.name}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {turnSplash && !showDraw && (
          <div className="absolute inset-0 z-[58] flex items-center justify-center pointer-events-none">
            <div className="turn-splash bg-amber-500 text-slate-950 font-black text-3xl uppercase tracking-wide px-8 py-4 rounded-2xl shadow-2xl">
              ¡Tu turno!
            </div>
          </div>
        )}

        <TegMap
          board={board}
          selectedFromId={selectedFromId}
          selectedToId={targetId}
          onSelectCountry={handleSelectCountry}
          myColor={myColor}
          highlightContinent={hoveredContinent}
          combat={shownCombat}
          events={events}
        />
      </div>

      {/* Paneles de acción (1/4 restante, con scroll propio) */}
      <aside className="col-span-1 min-h-0 overflow-y-auto border-l border-slate-800 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-black tracking-wide text-slate-300 truncate">{room.name}</span>
          <span className="ml-auto flex items-center gap-1">
            {spectator ? (
              <span className="flex items-center gap-1 text-slate-300 font-bold mr-1">
                <Eye className="w-3.5 h-3.5" /> Mirando
              </span>
            ) : (
              myColor && (
                <span className="flex items-center gap-1.5 mr-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_CONFIG[myColor].hex }} />
                  <span className="font-bold text-white">{myState?.name}</span>
                </span>
              )
            )}
            <button
              onClick={() => setShowRules(true)}
              title="Reglas"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => (spectator ? wsService.leaveRoom() : wsService.exitRoom())}
              title={spectator ? 'Dejar de mirar' : 'Volver al navegador (podés retomarla después)'}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
            {!spectator && !board.winner && (
              <button
                onClick={abandon}
                title="Abandonar la partida"
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-800"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </span>
        </div>

        {board.winner && (
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 p-5 rounded-2xl shadow-2xl text-center space-y-2">
            <Trophy className="w-10 h-10 mx-auto" />
            <h2 className="text-xl font-black uppercase tracking-wide">
              {board.winner === myColor ? '¡Ganaste!' : `Ganó ${board.players[board.winner]?.name}`}
            </h2>
            <button
              onClick={() => wsService.exitRoom()}
              className="text-sm font-bold underline underline-offset-2"
            >
              Volver al navegador
            </button>
          </div>
        )}

        <TurnOrderPanel board={board} myColor={myColor} onShowDraw={() => setShowDraw(true)} />

        <GameControls
          board={board}
          myColor={myColor}
          selectedFromId={selectedFromId}
          selectedToId={targetId}
          countries={countries}
          lastCombat={lastCombat}
          onOpenCards={() => setShowCardsModal(true)}
          onClearSelection={clearSelection}
        />

        <ContinentBonusPanel board={board} myColor={myColor} onHoverContinent={setHoveredContinent} />
      </aside>
    </div>
  );
};
