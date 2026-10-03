import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Me, RoomSummary } from '../../types/game';
import { COLOR_CONFIG } from '../../types/game';
import { api } from '../../services/api';
import {
  Swords,
  Lock,
  RefreshCw,
  Plus,
  Zap,
  Search,
  Eye,
  LogOut,
  Users,
  Bot,
  Crown,
  ChevronUp,
  ChevronDown,
  Play,
  Hash,
  X,
} from 'lucide-react';

interface ServerBrowserProps {
  me: Me;
  onJoin: (code: string, opts?: { password?: string; spectate?: boolean }) => void;
  onCreate: (name: string, maxPlayers: number, password: string) => Promise<void>;
  onQuickMatch: () => void;
  onLogout: () => void;
}

type Tab = 'all' | 'mine';
type SortKey = 'name' | 'host' | 'players' | 'status' | 'createdAt';

interface Filters {
  search: string;
  hideFull: boolean;
  hidePlaying: boolean;
  hidePrivate: boolean;
}

const FILTERS_KEY = 'teg_browser_filters';

const loadFilters = (): Filters => {
  const defaults = { search: '', hideFull: false, hidePlaying: false, hidePrivate: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}'), search: '' };
  } catch {
    return defaults;
  }
};

const STATUS_ORDER = { waiting: 0, playing: 1, finished: 2 };

const timeAgo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

const StatusBadge: React.FC<{ room: RoomSummary }> = ({ room }) => {
  const [label, cls] =
    room.status === 'waiting'
      ? ['Esperando', 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30']
      : room.paused
        ? ['En pausa', 'text-slate-300 bg-slate-500/10 border-slate-500/30']
        : ['En curso', 'text-amber-300 bg-amber-500/10 border-amber-500/30'];
  return <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${cls}`}>{label}</span>;
};

// Acción principal según la sala: retomar la mía, unirse si hay lugar, o mirar
const primaryAction = (room: RoomSummary): { label: string; spectate: boolean } | null => {
  if (room.mine) return { label: room.status === 'waiting' ? 'Volver a la sala' : 'Retomar', spectate: false };
  if (room.status === 'waiting' && room.players < room.maxPlayers) return { label: 'Unirse', spectate: false };
  return { label: 'Mirar', spectate: true };
};

export const ServerBrowser: React.FC<ServerBrowserProps> = ({ me, onJoin, onCreate, onQuickMatch, onLogout }) => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [sort, setSort] = useState<Sort>({ key: 'createdAt', desc: true });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [passwordFor, setPasswordFor] = useState<{ code: string; spectate: boolean } | null>(null);
  const [joinCode, setJoinCode] = useState('');

  const refresh = useCallback(
    () =>
      api.rooms().then(
        (list) => {
          setRooms(list);
          setLoadError(null);
          setLoading(false);
        },
        (e: Error) => {
          setLoadError(e.message);
          setLoading(false);
        },
      ),
    [],
  );

  // La lista se actualiza sola cada pocos segundos
  useEffect(() => {
    const timer = setInterval(refresh, 5000);
    const first = setTimeout(refresh, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [refresh]);

  const updateFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    try {
      const { search: _search, ...persisted } = next;
      localStorage.setItem(FILTERS_KEY, JSON.stringify(persisted));
    } catch {
      /* sin almacenamiento: los filtros duran lo que la pestaña */
    }
  };

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const list = rooms.filter((r) => {
      if (tab === 'mine') return r.mine;
      if (q && !r.name.toLowerCase().includes(q) && !r.host.toLowerCase().includes(q) && r.code !== q.toUpperCase())
        return false;
      if (filters.hideFull && r.players >= r.maxPlayers && !r.mine) return false;
      if (filters.hidePlaying && r.status !== 'waiting' && !r.mine) return false;
      if (filters.hidePrivate && r.private && !r.mine) return false;
      return true;
    });
    const dir = sort.desc ? -1 : 1;
    return list.sort((a, b) => {
      const v =
        sort.key === 'players'
          ? a.players - b.players
          : sort.key === 'status'
            ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
            : sort.key === 'createdAt'
              ? a.createdAt.localeCompare(b.createdAt)
              : a[sort.key].localeCompare(b[sort.key]);
      return v * dir;
    });
  }, [rooms, tab, filters, sort]);

  const selected = rooms.find((r) => r.code === selectedCode) ?? null;
  const mineCount = rooms.filter((r) => r.mine).length;

  const join = (room: RoomSummary, spectate: boolean) => {
    // Para volver a mi lugar no hace falta la contraseña
    if (room.private && !room.mine) setPasswordFor({ code: room.code, spectate });
    else onJoin(room.code, { spectate });
  };

  const toggle = (on: boolean, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold transition ${
        on
          ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
          : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Barra superior */}
      <header className="shrink-0 h-14 border-b border-slate-800 bg-slate-900/80 flex items-center px-5 gap-6">
        <div className="flex items-center gap-2.5">
          <Swords className="w-5 h-5 text-amber-400" />
          <span className="font-black text-lg tracking-wide text-white">TEGNet</span>
        </div>
        <nav className="flex h-full">
          {(
            [
              ['all', 'Partidas', rooms.length],
              ['mine', 'Mis partidas', mineCount],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 h-full text-sm font-bold transition flex items-center gap-2 ${
                tab === id ? 'text-white shadow-[inset_0_-2px_0_#f59e0b]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
              <span className="text-[11px] text-slate-500 font-semibold">{n}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-300">
            <span className="font-bold text-white">{me.name}</span>
            {me.guest && (
              <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                invitado
              </span>
            )}
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 rounded-md hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      {/* Herramientas */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-slate-800 bg-slate-950">
        {tab === 'all' && (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                placeholder="Buscar sala, anfitrión o código"
                className="w-72 bg-slate-900 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            {toggle(filters.hideFull, 'Ocultar llenas', () => updateFilters({ hideFull: !filters.hideFull }))}
            {toggle(filters.hidePlaying, 'Ocultar en curso', () => updateFilters({ hidePlaying: !filters.hidePlaying }))}
            {toggle(filters.hidePrivate, 'Ocultar privadas', () => updateFilters({ hidePrivate: !filters.hidePrivate }))}
          </>
        )}
        {tab === 'mine' && (
          <p className="text-sm text-slate-400">
            {me.guest
              ? 'Las partidas de invitado se pueden retomar mientras no cierres sesión.'
              : 'Partidas en las que tenés un lugar. Retomalas cuando quieras.'}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={refresh}
            title="Actualizar"
            className="p-2 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onQuickMatch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 text-sm font-bold text-slate-200 hover:border-slate-500 hover:text-white transition"
          >
            <Zap className="w-4 h-4 text-amber-400" /> Partida rápida vs bots
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-sm font-extrabold text-slate-950 transition"
          >
            <Plus className="w-4 h-4" /> Crear partida
          </button>
        </div>
      </div>

      {/* Lista + detalle */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 z-10">
              <tr>
                <th className="w-10 px-3 py-2" />
                <SortHeader sort={sort} setSort={setSort} k="name">Nombre</SortHeader>
                <SortHeader sort={sort} setSort={setSort} k="host">Anfitrión</SortHeader>
                <SortHeader sort={sort} setSort={setSort} k="players" className="w-28">
                  Jugadores
                </SortHeader>
                <SortHeader sort={sort} setSort={setSort} k="status" className="w-32">
                  Estado
                </SortHeader>
                <th className="w-16 px-3 py-2 font-bold" title="Espectadores">
                  <Eye className="w-3.5 h-3.5" />
                </th>
                <SortHeader sort={sort} setSort={setSort} k="createdAt" className="w-32">
                  Creada
                </SortHeader>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.code}
                  onClick={() => setSelectedCode(r.code)}
                  onDoubleClick={() => {
                    const a = primaryAction(r);
                    if (a) join(r, a.spectate);
                  }}
                  className={`border-b border-slate-800/60 cursor-default select-none transition ${
                    r.code === selectedCode
                      ? 'bg-amber-500/10 shadow-[inset_3px_0_0_#f59e0b]'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="px-3 py-2.5 text-slate-500">{r.private && <Lock className="w-3.5 h-3.5" />}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-white">{r.name}</span>
                    {r.mine && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">tu partida</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{r.host || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-300">
                    <Users className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-slate-500" />
                    {r.players}/{r.maxPlayers}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge room={r} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-400">{r.spectators || ''}</td>
                  <td className="px-3 py-2.5 text-slate-400">{timeAgo(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && visible.length === 0 && (
            <div className="py-20 text-center space-y-3">
              <p className="text-slate-400">
                {loadError
                  ? loadError
                  : tab === 'mine'
                    ? 'No tenés partidas en curso.'
                    : rooms.length
                      ? 'Ninguna sala coincide con los filtros.'
                      : 'Todavía no hay salas.'}
              </p>
              {!loadError && tab === 'all' && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-sm font-bold text-amber-400 hover:text-amber-300"
                >
                  Crear la primera partida
                </button>
              )}
            </div>
          )}
        </div>

        {/* Detalle */}
        <aside className="w-80 shrink-0 border-l border-slate-800 bg-slate-900/40 flex flex-col">
          {selected ? (
            <RoomDetail room={selected} onAction={join} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-slate-500">
              Elegí una sala para ver quién está jugando.
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              if (!code) return;
              const known = rooms.find((r) => r.code === code);
              if (known) join(known, primaryAction(known)?.spectate ?? false);
              else onJoin(code);
              setJoinCode('');
            }}
            className="border-t border-slate-800 p-4 space-y-2"
          >
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Unirse con código</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={6}
                  placeholder="ABC123"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md pl-7 pr-2 py-1.5 text-sm font-mono uppercase text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <button className="px-3 rounded-md border border-slate-700 text-sm font-bold text-slate-200 hover:border-slate-500">
                Ir
              </button>
            </div>
          </form>
        </aside>
      </div>

      {showCreate && (
        <CreateRoomDialog
          defaultName={`Sala de ${me.name}`}
          onCancel={() => setShowCreate(false)}
          onCreate={async (name, max, pw) => {
            await onCreate(name, max, pw);
            setShowCreate(false);
          }}
        />
      )}

      {passwordFor && (
        <PasswordDialog
          onCancel={() => setPasswordFor(null)}
          onSubmit={(pw) => {
            onJoin(passwordFor.code, { password: pw, spectate: passwordFor.spectate });
            setPasswordFor(null);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

type Sort = { key: SortKey; desc: boolean };

const SortHeader: React.FC<{
  k: SortKey;
  sort: Sort;
  setSort: React.Dispatch<React.SetStateAction<Sort>>;
  children: React.ReactNode;
  className?: string;
}> = ({ k, sort, setSort, children, className = '' }) => (
  <th className={`px-3 py-2 font-bold ${className}`}>
    <button
      onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k === 'createdAt' }))}
      className="inline-flex items-center gap-1 hover:text-white transition"
    >
      {children}
      {sort.key === k && (sort.desc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
    </button>
  </th>
);

const RoomDetail: React.FC<{ room: RoomSummary; onAction: (room: RoomSummary, spectate: boolean) => void }> = ({
  room,
  onAction,
}) => {
  const action = primaryAction(room);
  const empty = Math.max(room.maxPlayers - room.seats.length, 0);
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {room.private && <Lock className="w-4 h-4 text-slate-400" />}
          <h2 className="font-extrabold text-white text-lg leading-tight">{room.name}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <StatusBadge room={room} />
          <span className="font-mono">#{room.code}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
          Jugadores · {room.players}/{room.maxPlayers}
        </h3>
        <ul className="space-y-1">
          {room.seats.map((s) => (
            <li key={s.color} className="flex items-center gap-2 text-sm bg-slate-950/60 rounded-md px-2.5 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_CONFIG[s.color]?.hex }} />
              <span className={`flex-1 truncate ${s.connected ? 'text-white' : 'text-slate-500'}`}>{s.name}</span>
              {s.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
              {s.isBot && <Bot className="w-3.5 h-3.5 text-slate-400" />}
              {!s.isBot && !s.connected && room.status !== 'waiting' && (
                <span className="text-[10px] text-slate-500">desconectado</span>
              )}
            </li>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`e${i}`} className="text-sm text-slate-600 border border-dashed border-slate-800 rounded-md px-2.5 py-1.5">
              Lugar libre
            </li>
          ))}
        </ul>
      </div>

      {room.spectators > 0 && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> {room.spectators} mirando
        </p>
      )}

      <div className="space-y-2 pt-1">
        {action && (
          <button
            onClick={() => onAction(room, action.spectate)}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2.5 rounded-lg transition"
          >
            {action.spectate ? <Eye className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {action.label}
          </button>
        )}
        {action && !action.spectate && !room.mine && (
          <button
            onClick={() => onAction(room, true)}
            className="w-full flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-200 font-bold py-2 rounded-lg transition text-sm"
          >
            <Eye className="w-4 h-4" /> Mirar
          </button>
        )}
      </div>
    </div>
  );
};

const Dialog: React.FC<{ title: string; onCancel: () => void; children: React.ReactNode }> = ({
  title,
  onCancel,
  children,
}) => (
  <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="font-extrabold text-white">{title}</h2>
        <button onClick={onCancel} aria-label="Cerrar" className="text-slate-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const dialogInput =
  'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70';

const CreateRoomDialog: React.FC<{
  defaultName: string;
  onCancel: () => void;
  onCreate: (name: string, maxPlayers: number, password: string) => Promise<void>;
}> = ({ defaultName, onCancel, onCreate }) => {
  const [name, setName] = useState(defaultName);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog title="Crear partida" onCancel={onCancel}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isPrivate && !password) {
            setError('Poné una contraseña o desmarcá "Privada".');
            return;
          }
          setBusy(true);
          setError(null);
          try {
            await onCreate(name, maxPlayers, isPrivate ? password : '');
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
        className="p-5 space-y-4"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-400">Nombre</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={dialogInput} />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-400">Jugadores</span>
          <div className="grid grid-cols-5 gap-1.5">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxPlayers(n)}
                className={`py-1.5 rounded-md border text-sm font-bold transition ${
                  maxPlayers === n
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                    : 'border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="accent-amber-500 w-4 h-4"
          />
          <Lock className="w-3.5 h-3.5 text-slate-400" /> Privada (con contraseña)
        </label>
        {isPrivate && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña de la sala"
            className={dialogInput}
          />
        )}

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border border-slate-700 text-sm font-bold text-slate-300 hover:text-white">
            Cancelar
          </button>
          <button
            disabled={busy}
            className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-sm font-extrabold text-slate-950"
          >
            Crear
          </button>
        </div>
      </form>
    </Dialog>
  );
};

const PasswordDialog: React.FC<{ onCancel: () => void; onSubmit: (password: string) => void }> = ({
  onCancel,
  onSubmit,
}) => {
  const [password, setPassword] = useState('');
  return (
    <Dialog title="Sala privada" onCancel={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(password);
        }}
        className="p-5 space-y-4"
      >
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className={dialogInput}
        />
        <button className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-extrabold text-slate-950">
          Entrar
        </button>
      </form>
    </Dialog>
  );
};
