import React from 'react';
import type { CardState, CountryDef } from '../../types/game';
import { FIGURE_LABELS } from '../../types/game';
import { Layers } from 'lucide-react';

interface NewCardModalProps {
  cards: CardState[];
  countries: Record<number, CountryDef>;
  onClose: () => void;
}

// Aviso de las tarjetas que acabo de recibir (al terminar un turno con
// conquista, o las que heredo al eliminar a un jugador).
export const NewCardModal: React.FC<NewCardModalProps> = ({ cards, countries, onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Layers className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-xl font-bold text-white">
          {cards.length === 1 ? '¡Ganaste una tarjeta!' : `¡Ganaste ${cards.length} tarjetas!`}
        </h3>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {cards.map((c) => {
          const def = countries[c.countryId];
          return (
            <div
              key={c.countryId}
              className="w-36 rounded-2xl p-4 border border-amber-500/60 bg-slate-950 shadow-lg shadow-amber-500/10 space-y-2"
            >
              <h4 className="font-extrabold text-white">{def?.name ?? `País #${c.countryId}`}</h4>
              <p className="text-xs text-slate-400">{def?.continent}</p>
              <p className="text-sm font-semibold text-amber-300 border-t border-slate-800 pt-2">
                {FIGURE_LABELS[c.figure] ?? c.figure}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-xl font-extrabold text-sm transition"
      >
        Entendido
      </button>
    </div>
  </div>
);
