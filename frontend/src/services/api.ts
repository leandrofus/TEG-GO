import type { Me, RoomSummary } from '../types/game';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const buildUrl = (path: string) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

// Cliente de la API HTTP. La sesión viaja en una cookie. Con el deployment real
// que te describiste, el frontend y el backend están en el mismo dominio, así que
// por defecto usamos el mismo origen; si se necesita, se puede sobreescribir con
// una variable de entorno.

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const absoluteUrl = buildUrl(url);
  const res = await fetch(absoluteUrl, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo conectar con el servidor.');
  return data as T;
}

export const api = {
  me: () => request<Me>('GET', '/api/auth/me'),
  login: (username: string, password: string) => request<Me>('POST', '/api/auth/login', { username, password }),
  register: (username: string, password: string) => request<Me>('POST', '/api/auth/register', { username, password }),
  guest: (name: string) => request<Me>('POST', '/api/auth/guest', { name }),
  logout: () => request<void>('POST', '/api/auth/logout'),

  rooms: () => request<RoomSummary[]>('GET', '/api/rooms'),
  createRoom: (name: string, maxPlayers: number, password: string) =>
    request<{ code: string }>('POST', '/api/rooms', { name, maxPlayers, password }),
};
