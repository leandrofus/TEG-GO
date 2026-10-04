import React from 'react';
import type { Color, RoomState } from '../../types/game';
import { COLOR_CONFIG } from '../../types/game';
import { wsService } from '../../services/websocket';
import { ArrowLeft, Bot, Check, Dices, Lock } from 'lucide-react';
import { Die } from '../game/Die';
import { useDiceReveal } from '../game/turns';

const ALL_COLORS = Object.keys(COLOR_CONFIG) as Color[];

// Sorteo de turnos y elección de colores: se muestran los dados y después,
// en el orden sorteado, cada jugador elige su color. Los bots eligen solos.
export const ColorPick: React.FC<{ room: RoomState }> = ({ room }) => {
  const seats = room.seats;
  const stages = Math.max(1, ...seats.map((s) => s.rolls?.length ?? 0));
  // Los dados se animan solo si se entra recién sorteado (nadie eligió todavía)
  const { shown, face, done } = useDiceReveal(stages, !seats.some((s) => s.picked));

  const me = room.you.role === 'player' ? seats.find((s) => s.color === room.you.color) : undefined;
  const next = done
    ? seats.filter((s) => !s.picked).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]
    : undefined;
  const myTurn = !!me && next === me;

  // Mientras ruedan los dados se muestran en el orden de la sala, para no
  // adelantar el resultado; después, en el orden sorteado
  const rows = done ? [...seats].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : seats;
  const pickedBy = (c: Color) => seats.find((s) => s.picked && s.color === c);

  const leave = () => {
    if (window.confirm('¿Salir? Un bot va a ocupar tu lugar.')) wsService.leaveRoom();
  };

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 h-14 border-b border-slate-800 bg-slate-900/80 flex items-center px-5 gap-4">
        <button
          onClick={room.you.role === 'spectator' ? () => wsService.leaveRoom() : leave}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Salir de la sala
        </button>
        <div className="h-6 w-px bg-slate-800" />
        <div className="flex items-center gap-2 min-w-0">
          {room.private && <Lock className="w-4 h-4 text-slate-400 shrink-0" />}
          <h1 className="font-extrabold text-white truncate">{room.name}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <Dices className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Sorteo de turnos</h2>
              <p className="text-sm text-slate-400">
                {!done
                  ? shown === 0
                    ? 'Cada jugador tira un dado…'
                    : 'Desempate entre los que sacaron lo mismo…'
                  : 'Empieza el que sacó más. En ese orden, cada uno elige su color.'}
              </p>
            </div>
          </div>

          <ol className="space-y-2">
            {rows.map((s) => {
              const rolls = s.rolls ?? [];
              const rolling = !done && rolls.length > shown;
              const isNext = s === next;
              return (
                <li
                  key={`${s.order}-${s.name}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-900 border ${
                    isNext ? 'border-amber-500/70' : s === me ? 'border-slate-600' : 'border-slate-800'
                  }`}
                >
                  <span className="w-7 text-center font-black text-amber-400">{done ? `${s.order}°` : ''}</span>
                  <span
                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                      s.picked ? '' : 'border-2 border-dashed border-slate-700'
                    }`}
                    style={{ backgroundColor: s.picked ? COLOR_CONFIG[s.color].hex : undefined }}
                  >
                    {s.isBot && <Bot className={`w-4 h-4 ${s.picked ? 'text-white' : 'text-slate-500'}`} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-bold text-white">
                      {s.name}
                      {s === me && <span className="text-slate-400 font-medium"> (vos)</span>}
                    </span>
                    {done && (
                      <span className="block text-xs text-slate-400">
                        {s.picked ? (
                          COLOR_CONFIG[s.color].name
                        ) : isNext ? (
                          <span className="text-amber-300 animate-pulse">Eligiendo color…</span>
                        ) : (
                          'Espera su turno'
                        )}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {rolls.slice(0, shown).map((v, k) => (
                      <Die key={k} value={v} small={k > 0} dim={k < rolls.length - 1} />
                    ))}
                    {rolling && <Die value={face} small={shown > 0} />}
                  </span>
                </li>
              );
            })}
          </ol>

          {done && next && (
            <section className="space-y-3 border-t border-slate-800 pt-6">
              <h3 className="font-bold text-white">
                {myTurn ? '¡Te toca elegir color!' : `Le toca elegir a ${next.name}`}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {ALL_COLORS.map((c) => {
                  const owner = pickedBy(c);
                  return (
                    <button
                      key={c}
                      onClick={() => wsService.pickColor(c)}
                      disabled={!myTurn || !!owner}
                      title={owner ? `Lo eligió ${owner.name}` : COLOR_CONFIG[c].name}
                      className={`relative rounded-xl p-2 flex flex-col items-center gap-1.5 border transition ${
                        myTurn && !owner
                          ? 'border-slate-700 hover:border-amber-400 hover:-translate-y-0.5 cursor-pointer'
                          : 'border-slate-800 cursor-not-allowed'
                      } ${owner ? 'opacity-30' : !myTurn ? 'opacity-60' : ''}`}
                    >
                      <span className="w-10 h-10 rounded-lg shadow" style={{ backgroundColor: COLOR_CONFIG[c].hex }} />
                      <span className="text-[11px] font-bold text-slate-300">{COLOR_CONFIG[c].name}</span>
                      {owner && <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-slate-300" />}
                    </button>
                  );
                })}
              </div>
              {room.you.isHost && !next.isBot && !next.connected && (
                <button
                  onClick={() => wsService.replaceWithBot(next.color)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-200 border border-slate-600 hover:border-slate-400 rounded-lg px-2.5 py-1.5"
                >
                  <Bot className="w-3.5 h-3.5" /> {next.name} se desconectó: reemplazarlo por un bot
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
