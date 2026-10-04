import React from 'react';
import type { Color, GameBoard } from '../../types/game';
import { COLOR_CONFIG } from '../../types/game';
import { Bot, Dices, Layers, Map as MapIcon, Repeat } from 'lucide-react';
import { nextAliveIndex } from './turns';

interface TurnOrderPanelProps {
  board: GameBoard;
  myColor?: Color;
  onShowDraw?: () => void;
}

// Orden de los turnos: quién juega, quién sigue, y en qué ronda estamos
export const TurnOrderPanel: React.FC<TurnOrderPanelProps> = ({ board, myColor, onShowDraw }) => {
  const current = board.currentTurnIndex;
  const finished = board.currentPhase === 'finished';
  const next = nextAliveIndex(board, current);

  const owned: Partial<Record<Color, number>> = {};
  for (const c of Object.values(board.countries)) owned[c.owner] = (owned[c.owner] ?? 0) + 1;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-extrabold text-white">
          {board.round > 0
            ? `Ronda ${board.round}`
            : board.currentPhase.startsWith('initial_placement')
              ? 'Colocación inicial'
              : 'Orden de turnos'}
        </h3>
        {board.turnDraw && onShowDraw && (
          <button
            onClick={onShowDraw}
            title="Ver el sorteo de turnos"
            className="ml-auto flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
          >
            <Dices className="w-3.5 h-3.5" /> Sorteo
          </button>
        )}
      </div>

      <ol className="space-y-1">
        {board.turnOrder.map((color, i) => {
          const p = board.players[color];
          if (!p) return null;
          const isCurrent = i === current && !finished;
          const isNext = i === next && i !== current && !finished;
          const played = i < current && p.isAlive;
          return (
            <li
              key={color}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm border ${
                isCurrent ? 'bg-amber-500/10 border-amber-500/60' : 'border-transparent'
              } ${!p.isAlive ? 'opacity-40' : played ? 'opacity-70' : ''}`}
            >
              <span className="w-4 text-[11px] text-slate-500 font-bold text-right">{i + 1}</span>
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${isCurrent ? 'ring-2 ring-amber-300' : ''}`}
                style={{ backgroundColor: COLOR_CONFIG[color].hex }}
              />
              <span className={`flex-1 truncate ${p.isAlive ? 'text-white' : 'text-slate-400 line-through'}`}>
                <span className="font-bold">{p.name}</span>
                {color === myColor && <span className="text-slate-400"> (vos)</span>}
              </span>
              {p.isBot && <Bot className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              {isCurrent && (
                <span className="text-[10px] font-black uppercase tracking-wide text-amber-300">juega</span>
              )}
              {isNext && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">sigue</span>}
              {!p.isAlive && <span className="text-[10px] font-bold uppercase text-rose-400">eliminado</span>}
              {p.isAlive && (
                <span className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
                  <span className="flex items-center gap-0.5" title="Países">
                    <MapIcon className="w-3 h-3" />
                    {owned[color] ?? 0}
                  </span>
                  <span className="flex items-center gap-0.5" title="Tarjetas">
                    <Layers className="w-3 h-3" />
                    {p.cards?.length ?? 0}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
