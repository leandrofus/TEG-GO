type MessageHandler = (data: any) => void;
type StatusHandler = (connected: boolean) => void;

// Conexión con el server del juego. Se autentica con la cookie de sesión.
// Si se corta, reintenta solo y vuelve a entrar a la sala en la que estaba
// (el server le devuelve su lugar).
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private statusListeners: Set<StatusHandler> = new Set();
  private serverUrl: string;
  private wantOpen = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting: Promise<void> | null = null;
  // Sala a la que hay que volver si la conexión se reabre
  private room: { code: string; password?: string; spectate?: boolean } | null = null;

  constructor() {
    if (apiBaseUrl) {
      const wsBaseUrl = apiBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      this.serverUrl = `${wsBaseUrl}/ws`;
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.serverUrl = `${protocol}//${window.location.host}/ws`;
  }

  connect(): Promise<void> {
    this.wantOpen = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.connecting = null;
        this.emitStatus(true);
        if (this.room) this.rawSend('JOIN_ROOM', { roomCode: this.room.code, ...this.room });
        resolve();
      };
      ws.onerror = () => {
        this.connecting = null;
        reject(new Error('No se pudo conectar con el servidor de TEG.'));
      };
      ws.onclose = () => {
        this.connecting = null;
        if (this.ws === ws) this.ws = null;
        this.emitStatus(false);
        if (this.wantOpen) this.scheduleRetry();
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'LEFT_ROOM' || payload.type === 'KICKED' || payload.type === 'JOIN_FAILED') {
            this.room = null;
          }
          this.listeners.forEach((handler) => handler(payload));
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };
    });
    return this.connecting;
  }

  // Cierra la conexión sin reintentar (al cerrar sesión)
  disconnect() {
    this.wantOpen = false;
    this.room = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect().catch(() => this.scheduleRetry());
    }, 2000);
  }

  private emitStatus(connected: boolean) {
    this.statusListeners.forEach((h) => h(connected));
  }

  subscribe(handler: MessageHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusListeners.add(handler);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  private rawSend(action: string, data: Record<string, any> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...data }));
      return true;
    }
    return false;
  }

  send(action: string, data: Record<string, any> = {}) {
    if (!this.rawSend(action, data)) {
      console.warn('WebSocket no está abierto. No se pudo enviar:', action);
    }
  }

  // --- Sala

  async joinRoom(code: string, opts: { password?: string; spectate?: boolean } = {}) {
    await this.connect();
    this.room = { code, ...opts };
    this.send('JOIN_ROOM', { roomCode: code, ...opts });
  }

  // Vuelve al navegador conservando el lugar (la partida se pausa)
  exitRoom() {
    this.room = null;
    this.send('EXIT_ROOM');
  }

  // Sale liberando el lugar; en una partida en curso lo toma un bot
  leaveRoom() {
    this.room = null;
    this.send('LEAVE_ROOM');
  }

  addBot() {
    this.send('ADD_BOT');
  }

  removeSeat(color: string) {
    this.send('REMOVE_SEAT', { color });
  }

  startGame() {
    this.send('START_GAME');
  }

  pickColor(color: string) {
    this.send('PICK_COLOR', { color });
  }

  replaceWithBot(color: string) {
    this.send('REPLACE_WITH_BOT', { color });
  }

  // --- Jugadas

  placeTroops(countryId: number, count: number) {
    this.send('PLACE_TROOPS', { countryId, count });
  }

  skipTrade() {
    this.send('SKIP_TRADE');
  }

  attack(fromCountryId: number, toCountryId: number) {
    this.send('ATTACK', { fromCountryId, toCountryId });
  }

  moveAfterConquest(count: number) {
    this.send('MOVE_CONQUEST', { count });
  }

  passToRearrange() {
    this.send('PASS_REARRANGE');
  }

  rearrange(fromCountryId: number, toCountryId: number, count: number) {
    this.send('REARRANGE', { fromCountryId, toCountryId, count });
  }

  endTurn() {
    this.send('END_TURN');
  }
}

export const wsService = new WebSocketService();
