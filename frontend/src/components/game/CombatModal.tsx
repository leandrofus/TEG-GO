import React, { useEffect } from 'react';
import type { CombatResultData, GameBoard, Color, CountryDef } from '../../types/game';
import { COLOR_CONFIG } from '../../types/game';
import { Swords, X, Flag, Shield } from 'lucide-react';

interface CombatModalProps {
  combat: CombatResultData;
  board: GameBoard;
  countries: Record<number, CountryDef>;
  myColor?: Color;
  onClose: () => void;
}

// Cuánto queda en pantalla antes de cerrarse solo
export const COMBAT_MODAL_MS = 3200;

const PlayerChip: React.FC<{ color: Color; name: string; isMe: boolean }> = ({ color, name, isMe }) => (
  <span className="inline-flex items-center gap-1.5 font-bold text-white min-w-0">
    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLOR_CONFIG[color]?.hex }} />
    <span className="truncate">{isMe ? `${name} (vos)` : name}</span>
  </span>
);

const Die: React.FC<{ value?: number; tone: 'atk' | 'def'; state: 'win' | 'lose' | 'unused' }> = ({
  value,
  tone,
  state,
}) =>
  value === undefined ? (
    <span className="w-11 h-11" />
  ) : (
    <span
      className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl font-black shadow-lg transition ${
        tone === 'atk' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-900'
      } ${state === 'lose' ? 'opacity-30 scale-90' : state === 'unused' ? 'opacity-50' : 'ring-2 ring-emerald-400'}`}
    >
      {value}
    </span>
  );

export const CombatModal: React.FC<CombatModalProps> = ({ combat, board, countries, myColor, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, COMBAT_MODAL_MS);
    return () => clearTimeout(t);
  }, [combat, onClose]);

  const attacker = board.players[combat.attacker];
  const defender = board.players[combat.defender];
  const fromName = countries[combat.fromCountryId]?.name ?? `País #${combat.fromCountryId}`;
  const toName = countries[combat.toCountryId]?.name ?? `País #${combat.toCountryId}`;

  const pairs = Math.min(combat.attackerDice.length, combat.defenderDice.length);

  const atkName = attacker?.name ?? 'Atacante';
  const defName = defender?.name ?? 'Defensor';
  let verdict: React.ReactNode;
  let tone: string;
  if (combat.conquered) {
    tone = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200';
    verdict = (
      <>
        <Flag className="w-4 h-4 shrink-0" /> ¡{atkName} conquistó {toName}!
      </>
    );
  } else if (combat.defenderLosses > combat.attackerLosses) {
    tone = 'border-amber-500/60 bg-amber-500/15 text-amber-200';
    verdict = (
      <>
        <Swords className="w-4 h-4 shrink-0" /> Gana {atkName}: {defName} pierde {combat.defenderLosses}
      </>
    );
  } else if (combat.attackerLosses > combat.defenderLosses) {
    tone = 'border-sky-500/60 bg-sky-500/15 text-sky-200';
    verdict = (
      <>
        <Shield className="w-4 h-4 shrink-0" /> Resiste {defName}: {atkName} pierde {combat.attackerLosses}
      </>
    );
  } else {
    tone = 'border-slate-500/60 bg-slate-500/15 text-slate-200';
    verdict = <>Empate: cada uno pierde {combat.attackerLosses}</>;
  }

  const dieState = (i: number, side: 'atk' | 'def') => {
    if (i >= pairs) return 'unused' as const;
    const atkWins = combat.attackerDice[i] > combat.defenderDice[i];
    return (side === 'atk') === atkWins ? ('win' as const) : ('lose' as const);
  };

  // Abajo al centro, sobre el océano; no bloquea los clicks en el mapa salvo la ✕
  return (
    <div className="absolute inset-x-0 bottom-4 z-[60] flex justify-center pointer-events-none px-4">
      <div className="w-full max-w-xl bg-slate-950/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="px-4 pt-3 pb-3 space-y-3">
          {/* Quién contra quién */}
          <div className="flex items-center gap-3 text-sm">
            <Swords className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0">
                <PlayerChip color={combat.attacker} name={atkName} isMe={combat.attacker === myColor} />
                <div className="text-[11px] text-slate-400 truncate">ataca desde {fromName}</div>
              </div>
              <span className="text-slate-600 font-black text-xs">VS</span>
              <div className="min-w-0 text-right">
                <div className="flex justify-end">
                  <PlayerChip color={combat.defender} name={defName} isMe={combat.defender === myColor} />
                </div>
                <div className="text-[11px] text-slate-400 truncate">defiende {toName}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="pointer-events-auto p-1 -m-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dados: los del atacante frente a los del defensor (el defensor gana los empates) */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex gap-2">
              {combat.attackerDice.map((d, i) => (
                <Die key={i} value={d} tone="atk" state={dieState(i, 'atk')} />
              ))}
            </div>
            <span className="text-slate-600 text-xs font-bold">vs</span>
            <div className="flex gap-2">
              {combat.defenderDice.map((d, i) => (
                <Die key={i} value={d} tone="def" state={dieState(i, 'def')} />
              ))}
            </div>
          </div>

          <div className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold ${tone}`}>
            {verdict}
          </div>
        </div>

        {/* Barra de tiempo hasta que se cierra sola */}
        <div className="h-1 bg-slate-800">
          <div
            key={`${combat.fromCountryId}-${combat.toCountryId}-${combat.attackerDice.join('')}-${combat.defenderDice.join('')}`}
            className="h-full bg-slate-500 origin-left"
            style={{ animation: `combat-timer ${COMBAT_MODAL_MS}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  );
};
