import React, { useState } from 'react';
import type { GameBoard, Color, CountryDef, CombatResultData } from '../../types/game';
import { COLOR_CONFIG, PHASE_NAMES } from '../../types/game';
import { wsService } from '../../services/websocket';
import { Swords, ScrollText, Award, Layers, Minus, Plus, ArrowRight, Hourglass, Flag, Move } from 'lucide-react';

interface GameControlsProps {
  board: GameBoard;
  myColor?: Color;
  selectedFromId: number | null;
  selectedToId: number | null;
  countries: Record<number, CountryDef>;
  lastCombat: CombatResultData | null;
  onOpenCards: () => void;
  onClearSelection: () => void;
}

// Pasos de un turno normal, para mostrar en qué parte del turno estás
const TURN_STEPS = [
  { phase: 'trade_cards', label: 'Canje' },
  { phase: 'add_armies', label: 'Agregar' },
  { phase: 'attack', label: 'Atacar' },
  { phase: 'rearrange', label: 'Reagrupar' },
];

const isPlacementPhase = (phase: string) =>
  phase === 'initial_placement_1' || phase === 'initial_placement_2' || phase === 'add_armies';

export const GameControls: React.FC<GameControlsProps> = ({
  board,
  myColor,
  selectedFromId,
  selectedToId,
  countries,
  lastCombat,
  onOpenCards,
  onClearSelection,
}) => {
  const [count, setCount] = useState(1);
  const [showMission, setShowMission] = useState(false);

  const currentPlayer = board.players[board.turnOrder[board.currentTurnIndex]];
  const isMyTurn = currentPlayer?.color === myColor;
  const myState = myColor ? board.players[myColor] : null;
  const phase = board.currentPhase;

  const nameOf = (id: number | null) => (id ? countries[id]?.name ?? `País #${id}` : '');
  const armiesOf = (id: number | null) => (id ? board.countries[id]?.armies ?? 0 : 0);

  return (
    <div className="space-y-4">
      {/* Turno actual */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white shadow-lg shrink-0"
            style={{ backgroundColor: COLOR_CONFIG[currentPlayer?.color || 'black']?.hex }}
          >
            {currentPlayer?.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-white truncate">
              {isMyTurn ? 'Tu turno' : `Turno de ${currentPlayer?.name}`}
            </h3>
            <p className="text-xs text-slate-400">{PHASE_NAMES[phase] || phase}</p>
          </div>
        </div>

        {myState && (
          <div className="flex gap-2">
            <button
              onClick={onOpenCards}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" /> Tarjetas
              {myState.cards?.length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black rounded-full text-[10px] px-1.5">
                  {myState.cards.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowMission(!showMission)}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" /> Misión
            </button>
          </div>
        )}

        {showMission && myState && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 space-y-1">
            <h4 className="text-sm font-extrabold text-amber-400">{myState.mission.title}</h4>
            <p className="text-slate-300 text-xs leading-relaxed">{myState.mission.description}</p>
          </div>
        )}
      </div>

      {/* Acciones: solo en tu turno */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
        {!isMyTurn ? (
          <div className="flex items-center gap-3 text-slate-400 py-2">
            <Hourglass className="w-5 h-5 animate-pulse shrink-0" />
            <p className="text-sm">
              Esperando a <span className="font-bold text-slate-200">{currentPlayer?.name}</span>…
            </p>
          </div>
        ) : (
          <>
            {TURN_STEPS.some((s) => s.phase === phase) && <TurnStepper phase={phase} />}

            {/* Colocar ejércitos */}
            {isPlacementPhase(phase) && (
              <PlacementActions
                troopsLeft={currentPlayer?.troopsToPlace || 0}
                selectedId={selectedFromId}
                selectedName={nameOf(selectedFromId)}
                selectedArmies={armiesOf(selectedFromId)}
                count={count}
                setCount={setCount}
                onClear={onClearSelection}
              />
            )}

            {/* Canje */}
            {phase === 'trade_cards' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Con 3 tarjetas de la misma figura (o las 3 distintas) podés canjearlas por ejércitos.
                  {(myState?.cards?.length ?? 0) === 0 && ' Todavía no tenés tarjetas.'}
                </p>
                <div className="flex gap-2">
                  <ActionButton variant="secondary" onClick={onOpenCards} disabled={(myState?.cards?.length ?? 0) < 3}>
                    <Layers className="w-4 h-4" /> Canjear
                  </ActionButton>
                  <ActionButton variant="primary" onClick={() => wsService.skipTrade()}>
                    Continuar <ArrowRight className="w-4 h-4" />
                  </ActionButton>
                </div>
              </div>
            )}

            {/* Ataque */}
            {phase === 'attack' &&
              (board.pendingConquest ? (
                <ConquestMove
                  fromName={nameOf(board.pendingConquest.from)}
                  toName={nameOf(board.pendingConquest.to)}
                  max={board.pendingConquest.max}
                />
              ) : (
                <AttackActions
                  fromId={selectedFromId}
                  toId={selectedToId}
                  nameOf={nameOf}
                  armiesOf={armiesOf}
                  lastCombat={lastCombat}
                  onClear={onClearSelection}
                />
              ))}

            {/* Reagrupar */}
            {phase === 'rearrange' && (
              <RearrangeActions
                fromId={selectedFromId}
                toId={selectedToId}
                nameOf={nameOf}
                movable={
                  selectedFromId
                    ? armiesOf(selectedFromId) - 1 - (board.countries[selectedFromId]?.movedThisTurn ?? 0)
                    : 0
                }
                count={count}
                setCount={setCount}
                onClear={onClearSelection}
              />
            )}
          </>
        )}
      </div>

      {/* Registro */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-slate-400" /> Registro
        </h4>
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-40 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5">
          {board.logs
            .slice()
            .reverse()
            .map((log, i) => (
              <div key={i} className="leading-relaxed border-b border-slate-900/50 pb-1">
                {log}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const TurnStepper: React.FC<{ phase: string }> = ({ phase }) => {
  const current = TURN_STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="flex items-center gap-1 text-[11px] font-bold">
      {TURN_STEPS.map((s, i) => (
        <li
          key={s.phase}
          className={`flex-1 text-center py-1 rounded-md border ${
            i === current
              ? 'bg-amber-500 border-amber-400 text-slate-950'
              : i < current
                ? 'bg-slate-800 border-slate-700 text-slate-400'
                : 'border-slate-800 text-slate-500'
          }`}
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
};

// Selector de cantidad: − / + y accesos rápidos, sin teclado
export const CountPicker: React.FC<{
  value: number;
  max: number;
  onChange: (n: number) => void;
}> = ({ value, max, onChange }) => {
  const v = Math.min(Math.max(value, 1), Math.max(max, 1));
  const quick = max <= 5 ? Array.from({ length: max }, (_, i) => i + 1) : [1, Math.ceil(max / 2), max];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(v - 1)}
          disabled={v <= 1}
          aria-label="Uno menos"
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center disabled:opacity-30 transition"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-xl font-black text-white tabular-nums">
          {v}
        </div>
        <button
          onClick={() => onChange(v + 1)}
          disabled={v >= max}
          aria-label="Uno más"
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center disabled:opacity-30 transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {max > 1 && (
        <div className="flex gap-1.5">
          {quick.map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`flex-1 py-1 rounded-lg text-xs font-bold border transition ${
                n === v
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {n === max && max > 5 ? `Todas (${n})` : n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionButton: React.FC<{
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ variant, onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex-1 flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
      variant === 'primary'
        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
        : variant === 'danger'
          ? 'bg-rose-600 hover:bg-rose-500 text-white'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
    }`}
  >
    {children}
  </button>
);

// Casilla "Desde / Hacia" con el país elegido o una indicación de qué elegir
const Slot: React.FC<{ label: string; value?: string; hint: string; tone: 'from' | 'to' }> = ({
  label,
  value,
  hint,
  tone,
}) => (
  <div
    className={`flex-1 min-w-0 rounded-xl border px-3 py-2 ${
      value
        ? tone === 'from'
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-rose-500/60 bg-rose-500/10'
        : 'border-dashed border-slate-700'
    }`}
  >
    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
    <div className={`text-sm font-bold truncate ${value ? 'text-white' : 'text-slate-500 font-medium italic'}`}>
      {value || hint}
    </div>
  </div>
);

const PlacementActions: React.FC<{
  troopsLeft: number;
  selectedId: number | null;
  selectedName: string;
  selectedArmies: number;
  count: number;
  setCount: (n: number) => void;
  onClear: () => void;
}> = ({ troopsLeft, selectedId, selectedName, selectedArmies, count, setCount, onClear }) => {
  const n = Math.min(Math.max(count, 1), Math.max(troopsLeft, 1));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        Te quedan <span className="text-amber-400 font-black text-lg">{troopsLeft}</span> ejércitos para colocar.
      </p>
      {selectedId ? (
        <>
          <Slot label="En" value={`${selectedName} (${selectedArmies})`} hint="" tone="from" />
          <CountPicker value={n} max={troopsLeft} onChange={setCount} />
          <div className="flex gap-2">
            <ActionButton variant="secondary" onClick={onClear}>
              Cambiar país
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => {
                wsService.placeTroops(selectedId, n);
                setCount(1);
                onClear();
              }}
            >
              Colocar {n}
            </ActionButton>
          </div>
        </>
      ) : (
        <Slot label="En" hint="Tocá uno de tus países en el mapa" tone="from" />
      )}
    </div>
  );
};

const ConquestMove: React.FC<{ fromName: string; toName: string; max: number }> = ({ fromName, toName, max }) => (
  <div className="space-y-3 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3">
    <p className="text-sm text-emerald-200">
      <Flag className="inline w-4 h-4 mr-1 -mt-0.5" />
      ¡Conquistaste <strong className="text-white">{toName}</strong>!
    </p>
    <p className="text-xs text-slate-300">¿Cuántos ejércitos pasás desde {fromName}?</p>
    <div className="flex gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => wsService.moveAfterConquest(n)}
          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-black transition"
        >
          {n}
        </button>
      ))}
    </div>
  </div>
);

const Die: React.FC<{ value: number; tone: 'atk' | 'def'; lost: boolean }> = ({ value, tone, lost }) => (
  <span
    className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg shadow ${
      tone === 'atk' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-900'
    } ${lost ? 'opacity-35 line-through' : ''}`}
  >
    {value}
  </span>
);

const AttackActions: React.FC<{
  fromId: number | null;
  toId: number | null;
  nameOf: (id: number | null) => string;
  armiesOf: (id: number | null) => number;
  lastCombat: CombatResultData | null;
  onClear: () => void;
}> = ({ fromId, toId, nameOf, armiesOf, lastCombat, onClear }) => {
  const atkDice = Math.min(3, armiesOf(fromId) - 1);
  const defDice = Math.min(3, armiesOf(toId));
  const pairs = lastCombat ? Math.min(lastCombat.attackerDice.length, lastCombat.defenderDice.length) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Slot
          label="Desde"
          value={fromId ? `${nameOf(fromId)} (${armiesOf(fromId)})` : undefined}
          hint="Uno de tus países"
          tone="from"
        />
        <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
        <Slot
          label="Hacia"
          value={toId ? `${nameOf(toId)} (${armiesOf(toId)})` : undefined}
          hint={fromId ? 'Un enemigo vecino' : '—'}
          tone="to"
        />
      </div>

      {fromId && toId && (
        <p className="text-xs text-slate-400">
          Tirás {atkDice} {atkDice === 1 ? 'dado' : 'dados'} contra {defDice}.
        </p>
      )}

      <div className="flex gap-2">
        {(fromId || toId) && (
          <ActionButton variant="secondary" onClick={onClear}>
            Limpiar
          </ActionButton>
        )}
        <ActionButton
          variant="danger"
          disabled={!fromId || !toId}
          onClick={() => fromId && toId && wsService.attack(fromId, toId)}
        >
          <Swords className="w-4 h-4" /> Atacar
        </ActionButton>
      </div>

      {/* Resultado del último ataque propio */}
      {lastCombat && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
          <div className="text-[11px] text-slate-400">
            {nameOf(lastCombat.fromCountryId)} → {nameOf(lastCombat.toCountryId)}
          </div>
          <div className="flex items-center gap-1.5">
            {lastCombat.attackerDice.map((d, i) => (
              <Die
                key={`a${i}`}
                value={d}
                tone="atk"
                lost={i < pairs && lastCombat.defenderDice[i] >= d}
              />
            ))}
            <span className="text-slate-600 text-xs mx-1">vs</span>
            {lastCombat.defenderDice.map((d, i) => (
              <Die
                key={`d${i}`}
                value={d}
                tone="def"
                lost={i < pairs && lastCombat.attackerDice[i] > d}
              />
            ))}
          </div>
          <div className="text-xs">
            {lastCombat.conquered ? (
              <span className="text-emerald-400 font-bold">¡Conquistado!</span>
            ) : (
              <span className="text-slate-300">
                Perdiste {lastCombat.attackerLosses} · el enemigo perdió {lastCombat.defenderLosses}
              </span>
            )}
          </div>
        </div>
      )}

      <ActionButton variant="secondary" onClick={() => wsService.passToRearrange()}>
        Terminar ataques <ArrowRight className="w-4 h-4" />
      </ActionButton>
    </div>
  );
};

const RearrangeActions: React.FC<{
  fromId: number | null;
  toId: number | null;
  nameOf: (id: number | null) => string;
  movable: number;
  count: number;
  setCount: (n: number) => void;
  onClear: () => void;
}> = ({ fromId, toId, nameOf, movable, count, setCount, onClear }) => {
  const n = Math.min(Math.max(count, 1), Math.max(movable, 1));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Slot label="Desde" value={fromId ? nameOf(fromId) : undefined} hint="Uno de tus países" tone="from" />
        <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
        <Slot label="Hacia" value={toId ? nameOf(toId) : undefined} hint={fromId ? 'Un vecino tuyo' : '—'} tone="to" />
      </div>

      {fromId && toId && movable > 0 && (
        <>
          <CountPicker value={n} max={movable} onChange={setCount} />
          <div className="flex gap-2">
            <ActionButton variant="secondary" onClick={onClear}>
              Limpiar
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => {
                wsService.rearrange(fromId, toId, n);
                setCount(1);
                onClear();
              }}
            >
              <Move className="w-4 h-4" /> Mover {n}
            </ActionButton>
          </div>
        </>
      )}
      {fromId && toId && movable <= 0 && (
        <p className="text-xs text-slate-400">
          {nameOf(fromId)} no tiene ejércitos libres para mover este turno.
        </p>
      )}

      <ActionButton variant="primary" onClick={() => wsService.endTurn()}>
        Terminar turno
      </ActionButton>
    </div>
  );
};
