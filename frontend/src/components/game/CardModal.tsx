import React, { useState } from 'react';
import type { CardState, CountryDef } from '../../types/game';
import { FIGURE_LABELS } from '../../types/game';
import { wsService } from '../../services/websocket';
import { Layers, Coins, X, Check } from 'lucide-react';

interface CardModalProps {
  cards: CardState[];
  countries: Record<number, CountryDef>;
  isMyTurn: boolean;
  onClose: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({
  cards,
  countries,
  isMyTurn,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length < 3) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleTrade = () => {
    if (selectedIds.length === 3) {
      wsService.send('TRADE_CARDS', { cardIds: selectedIds });
      setSelectedIds([]);
      onClose();
    }
  };

  const handleCash = (countryId: number) => {
    wsService.send('CASH_CARD', { countryId });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 relative border-amber-500/30">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Layers className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Mis Tarjetas de País</h3>
            <p className="text-xs text-slate-400">
              Selecciona 3 tarjetas para canjear por ejércitos extra o cobra +2 ejércitos si posees el país.
            </p>
          </div>
        </div>

        {cards.length === 0 ? (
          <p className="text-center text-slate-500 py-12 italic text-sm">
            No tienes tarjetas en tu poder. Conquista al menos un país durante tu turno para obtener una tarjeta al finalizar.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
            {cards.map((c) => {
              const countryDef = countries[c.countryId];
              const isSelected = selectedIds.includes(c.countryId);

              return (
                <div
                  key={c.countryId}
                  onClick={() => toggleSelect(c.countryId)}
                  className={`cursor-pointer rounded-2xl p-4 border transition flex flex-col justify-between space-y-3 relative ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 rounded-full p-1 shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  <div>
                    <h4 className="font-extrabold text-sm text-white">{countryDef?.name || `País #${c.countryId}`}</h4>
                    <p className="text-xs text-slate-400 capitalize">{countryDef?.continent}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                    <span className="text-xs font-semibold text-amber-300">
                      {FIGURE_LABELS[c.figure] || c.figure}
                    </span>
                    {!c.cashed ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCash(c.countryId);
                        }}
                        disabled={!isMyTurn}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg font-bold transition disabled:opacity-50"
                        title="Cobrar +2 ejércitos en el país"
                      >
                        Cobrar (+2)
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Cobrada</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-xs text-slate-400 font-mono">
            Seleccionadas: <strong className="text-amber-400">{selectedIds.length} / 3</strong>
          </span>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm transition"
            >
              Cerrar
            </button>

            <button
              onClick={handleTrade}
              disabled={selectedIds.length !== 3 || !isMyTurn}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-xl font-extrabold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Coins className="w-4 h-4" /> Canjear Tarjetas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
