import React, { useState } from 'react';
import type { RoomState } from '../../types/game';
import { wsService } from '../../services/websocket';
import { ArrowLeft, Bot, Crown, Lock, Plus, X, Play, Eye, Copy, Check } from 'lucide-react';

export const WaitingRoom: React.FC<{ room: RoomState }> = ({ room }) => {
  const [copied, setCopied] = useState(false);
  const isHost = room.you.isHost;
  const spectator = room.you.role === 'spectator';
  const empty = Math.max(room.maxPlayers - room.seats.length, 0);
  const canStart = isHost && room.seats.length >= 2;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin portapapeles: el código igual está a la vista */
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 h-14 border-b border-slate-800 bg-slate-900/80 flex items-center px-5 gap-4">
        <button
          onClick={() => wsService.leaveRoom()}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Salir de la sala
        </button>
        <div className="h-6 w-px bg-slate-800" />
        <div className="flex items-center gap-2 min-w-0">
          {room.private && <Lock className="w-4 h-4 text-slate-400 shrink-0" />}
          <h1 className="font-extrabold text-white truncate">{room.name}</h1>
        </div>
        <button
          onClick={copyCode}
          title="Copiar código para invitar"
          className="flex items-center gap-1.5 font-mono text-sm text-slate-300 border border-slate-700 rounded-md px-2 py-1 hover:border-slate-500"
        >
          #{room.code}
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
        </button>
        {room.spectators > 0 && (
          <span className="ml-auto text-xs text-slate-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> {room.spectators} mirando
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white">Sala de espera</h2>
            <p className="text-sm text-slate-400">
              {spectator
                ? 'Estás mirando. La partida empieza cuando el anfitrión la inicie.'
                : isHost
                  ? 'Invitá jugadores con el código de la sala o completá los lugares con bots.'
                  : 'Esperando a que el anfitrión inicie la partida.'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {room.seats.map((s) => {
              const isMe = room.you.color === s.color;
              return (
                <div
                  key={s.color}
                  className={`relative rounded-xl border bg-slate-900 p-4 flex items-center gap-3 ${
                    isMe ? 'border-amber-500/60' : 'border-slate-800'
                  }`}
                >
                  {/* El color se elige al empezar, en el orden del sorteo */}
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center font-black text-white shrink-0">
                    {s.isBot ? <Bot className="w-5 h-5" /> : s.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                      {s.name}
                      {s.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-xs text-slate-400">
                      {isMe ? 'Vos' : s.isBot ? 'Bot' : s.connected ? 'Listo' : 'Desconectado'}
                    </div>
                  </div>
                  {isHost && !s.isHost && (
                    <button
                      onClick={() => wsService.removeSeat(s.color)}
                      title={s.isBot ? 'Quitar bot' : 'Sacar de la sala'}
                      className="absolute top-2 right-2 p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {Array.from({ length: empty }, (_, i) =>
              isHost ? (
                <button
                  key={`e${i}`}
                  onClick={() => wsService.addBot()}
                  className="rounded-xl border border-dashed border-slate-700 p-4 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-white hover:border-slate-500 transition min-h-[74px]"
                >
                  <Plus className="w-4 h-4" /> Agregar bot
                </button>
              ) : (
                <div
                  key={`e${i}`}
                  className="rounded-xl border border-dashed border-slate-800 p-4 flex items-center justify-center text-sm text-slate-600 min-h-[74px]"
                >
                  Lugar libre
                </div>
              ),
            )}
          </div>

          {isHost && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-6">
              <p className="text-sm text-slate-400">
                {room.seats.length < 2
                  ? 'Se necesitan al menos 2 jugadores.'
                  : `${room.seats.length} jugadores listos. Al empezar se sortea el orden de turnos y, en ese orden, cada uno elige su color.`}
              </p>
              <button
                onClick={() => wsService.startGame()}
                disabled={!canStart}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold px-6 py-3 rounded-xl transition"
              >
                <Play className="w-4 h-4" /> Comenzar partida
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
