import React from 'react';
import type { Color, PlayerState, TurnDraw } from '../../types/game';
import { COLOR_CONFIG } from '../../types/game';
import { Dices, X } from 'lucide-react';
import { Die } from './Die';

interface TurnDrawModalProps {
  draws: TurnDraw[];
  players: Record<Color, PlayerState>;
  myColor?: Color;
  onClose: () => void;
}

// Resultado del sorteo de turnos, para volver a verlo durante la partida.
export const TurnDrawModal: React.FC<TurnDrawModalProps> = ({ draws, players, myColor, onClose }) => (
  <div
    className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Dices className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Sorteo de turnos</h3>
          <p className="text-xs text-slate-400">Empezó el que sacó más; los empates se definieron con otra tirada.</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="ml-auto self-start text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <ol className="space-y-2">
        {draws.map((d, i) => (
          <li
            key={d.color}
            className="flex items-center gap-3 rounded-xl px-3 py-2 bg-slate-950/70 border border-slate-800"
          >
            <span className="w-6 text-center font-black text-amber-400">{i + 1}°</span>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLOR_CONFIG[d.color].hex }} />
            <span className="flex-1 truncate font-bold text-white">
              {players[d.color]?.name}
              {d.color === myColor && <span className="text-slate-400 font-medium"> (vos)</span>}
            </span>
            <span className="flex items-center gap-1.5">
              {d.rolls.map((v, k) => (
                <Die key={k} value={v} small={k > 0} dim={k < d.rolls.length - 1} />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);
