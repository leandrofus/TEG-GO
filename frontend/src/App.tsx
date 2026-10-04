import { useCallback, useEffect, useRef, useState } from 'react';
import type { CountryDef, Me, RoomState } from './types/game';
import { api } from './services/api';
import { wsService } from './services/websocket';
import { AuthScreen } from './components/auth/AuthScreen';
import { ServerBrowser } from './components/lobby/ServerBrowser';
import { WaitingRoom } from './components/lobby/WaitingRoom';
import { ColorPick } from './components/lobby/ColorPick';
import { GameScreen } from './components/game/GameScreen';
import { AlertCircle, Loader2, WifiOff } from 'lucide-react';

export function App() {
  // undefined = todavía no sabemos si hay sesión; null = no hay
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [countries, setCountries] = useState<Record<number, CountryDef>>({});
  const [connected, setConnected] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
    fetch('/api/game/data')
      .then((res) => res.json())
      .then((data) => setCountries(data.countries || {}))
      .catch((e) => console.error('Error cargando los datos del juego:', e));

    const offStatus = wsService.onStatus(setConnected);
    const offMessages = wsService.subscribe((p) => {
      switch (p.type) {
        case 'GAME_STATE':
          setRoom({
            code: p.room,
            name: p.name,
            status: p.status,
            started: p.started,
            picking: p.picking,
            maxPlayers: p.maxPlayers,
            private: p.private,
            seats: p.seats || [],
            spectators: p.spectators,
            waitingFor: p.waitingFor,
            you: p.you,
            board: p.board,
          });
          break;
        case 'LEFT_ROOM':
          setRoom(null);
          break;
        case 'KICKED':
        case 'SESSION_REPLACED':
          setRoom(null);
          notify(p.message);
          break;
        case 'JOIN_FAILED':
        case 'ERROR':
          notify(p.message);
          break;
      }
    });
    return () => {
      offStatus();
      offMessages();
    };
  }, [notify]);

  const joinRoom = useCallback(
    async (code: string, opts?: { password?: string; spectate?: boolean }) => {
      try {
        await wsService.joinRoom(code, opts);
      } catch (e) {
        notify((e as Error).message);
      }
    },
    [notify],
  );

  const createRoom = async (name: string, maxPlayers: number, password: string) => {
    const { code } = await api.createRoom(name, maxPlayers, password);
    await joinRoom(code, { password });
  };

  const quickMatch = async () => {
    try {
      const { code } = await api.createRoom('Batalla vs Bots', 4, '');
      await wsService.joinRoom(code);
      // El server procesa los mensajes en orden: entrar, sumar bots y empezar
      wsService.addBot();
      wsService.addBot();
      wsService.addBot();
      wsService.startGame();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    wsService.disconnect();
    setRoom(null);
    setMe(null);
  };

  let screen;
  if (me === undefined) {
    screen = (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  } else if (me === null) {
    screen = <AuthScreen onAuthenticated={setMe} />;
  } else if (!room) {
    screen = (
      <ServerBrowser me={me} onJoin={joinRoom} onCreate={createRoom} onQuickMatch={quickMatch} onLogout={logout} />
    );
  } else if (room.picking) {
    screen = <ColorPick room={room} />;
  } else if (!room.started) {
    screen = <WaitingRoom room={room} />;
  } else {
    screen = <GameScreen room={room} countries={countries} notify={notify} />;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {screen}

      {room && !connected && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 bg-slate-900 border border-slate-600 text-slate-200 text-sm font-bold px-4 py-2 rounded-xl shadow-2xl">
          <WifiOff className="w-4 h-4 text-amber-400" /> Se cortó la conexión. Reconectando…
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] max-w-sm bg-rose-950 border border-rose-600 text-rose-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="font-medium text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default App;
