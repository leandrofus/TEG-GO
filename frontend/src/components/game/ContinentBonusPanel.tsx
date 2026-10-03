import React from 'react';
import type { GameBoard, Color } from '../../types/game';
import { CONTINENT_COLORS } from '../../types/game';
import { Globe } from 'lucide-react';

interface ContinentBonusPanelProps {
  board?: GameBoard;
  myColor?: Color;
  // Avisa qué continente está bajo el mouse para resaltarlo en el mapa
  onHoverContinent?: (name: string | null) => void;
}

interface ContinentInfo {
  name: string;
  bonus: number;
  countryIds: number[];
}

const CONTINENT_DEFS: ContinentInfo[] = [
  { name: 'América del Norte', bonus: 5, countryIds: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
  { name: 'América del Sur', bonus: 3, countryIds: [1, 2, 3, 4, 5, 6] },
  { name: 'Europa', bonus: 5, countryIds: [17, 18, 19, 20, 21, 22, 23, 24, 25] },
  { name: 'África', bonus: 3, countryIds: [41, 42, 43, 44, 45, 46] },
  { name: 'Asia', bonus: 7, countryIds: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40] },
  { name: 'Oceanía', bonus: 2, countryIds: [47, 48, 49, 50] },
];

export const ContinentBonusPanel: React.FC<ContinentBonusPanelProps> = ({
  board,
  myColor,
  onHoverContinent,
}) => {
  if (!board || !myColor) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <Globe className="w-4 h-4 text-amber-400" /> Control de Continentes
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CONTINENT_DEFS.map((cont) => {
          let owned = 0;
          cont.countryIds.forEach((id) => {
            if (board.countries[id]?.owner === myColor) {
              owned++;
            }
          });

          const total = cont.countryIds.length;
          const isFull = owned === total;
          const percentage = Math.round((owned / total) * 100);

          return (
            <div
              key={cont.name}
              onMouseEnter={() => onHoverContinent?.(cont.name)}
              onMouseLeave={() => onHoverContinent?.(null)}
              className={`rounded-xl p-3 border text-xs space-y-1.5 transition cursor-default hover:border-slate-500 ${
                isFull
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: CONTINENT_COLORS[cont.name] }}
                  />
                  <span className="truncate">{cont.name}</span>
                </span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">
                  +{cont.bonus}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isFull ? 'bg-amber-400' : 'bg-blue-500'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Dominio:</span>
                <strong className={isFull ? 'text-amber-400' : 'text-slate-200'}>
                  {owned}/{total}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
