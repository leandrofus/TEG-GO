import { useEffect, useState } from 'react';
import type { Color, CombatResultData, CountryState } from '../../types/game';
import { wsService } from '../../services/websocket';

// Cuánto se ve un cambio en el mapa (indicador ▲/▼ y brillo del territorio)
export const EVENT_MS = 2600;

export interface CountryEvent {
  delta: number; // ejércitos ganados (+) o perdidos (−), acumulados mientras dura el evento
  conquered: boolean;
  fromColor?: Color; // dueño anterior, para el barrido de color
  toColor?: Color;
  origin?: number; // país desde el que lo conquistaron, si se sabe
  at: number;
  key: number; // cambia con cada novedad, para reiniciar la animación
}

export type BoardEvents = Record<number, CountryEvent>;

let eventSeq = 0;

// Escucha los estados que manda el server y compara cada uno con el anterior:
// devuelve, por país, lo que acaba de pasar en él. Se borran solos a los EVENT_MS.
export function useBoardEvents(): BoardEvents {
  const [events, setEvents] = useState<BoardEvents>({});

  useEffect(() => {
    let prevRoom: string | undefined;
    let prev: Record<number, CountryState> | undefined;
    let lastCombat: CombatResultData | undefined;

    return wsService.subscribe((p) => {
      if (p.type === 'COMBAT_EVENT') {
        lastCombat = p.combatResult; // dice desde dónde vino una conquista
        return;
      }
      if (p.type !== 'GAME_STATE') return;

      const countries: Record<number, CountryState> | undefined = p.board?.countries;
      const before = p.room === prevRoom ? prev : undefined;
      prevRoom = p.room;
      prev = countries;
      if (!before || !countries) return;

      const now = Date.now();
      const changes: BoardEvents = {};
      for (const key of Object.keys(countries)) {
        const id = Number(key);
        const was = before[id];
        const is = countries[id];
        if (!was || !is) continue;
        const delta = is.armies - was.armies;
        const conquered = is.owner !== was.owner;
        if (delta === 0 && !conquered) continue;
        changes[id] = {
          delta,
          conquered,
          fromColor: conquered ? was.owner : undefined,
          toColor: is.owner,
          origin: conquered && lastCombat?.toCountryId === id ? lastCombat.fromCountryId : undefined,
          at: now,
          key: ++eventSeq,
        };
      }
      if (!Object.keys(changes).length) return;

      // Si un país sigue cambiando mientras se ve el evento (p. ej. recibe tropas
      // de a una), se acumula en el mismo indicador
      setEvents((cur) => {
        const next = { ...cur };
        for (const [id, ch] of Object.entries(changes)) {
          const old = next[Number(id)];
          const alive = old && now - old.at < EVENT_MS;
          next[Number(id)] =
            alive && !ch.conquered
              ? { ...old, delta: old.delta + ch.delta, toColor: ch.toColor, at: now, key: ch.key }
              : ch;
        }
        return next;
      });
    });
  }, []);

  // Limpieza de los eventos vencidos
  useEffect(() => {
    const list = Object.values(events);
    if (!list.length) return;
    const wait = Math.min(...list.map((e) => e.at)) + EVENT_MS - Date.now();
    const timer = setTimeout(
      () =>
        setEvents((cur) => {
          const now = Date.now();
          return Object.fromEntries(Object.entries(cur).filter(([, e]) => now - e.at < EVENT_MS));
        }),
      Math.max(wait, 0) + 30,
    );
    return () => clearTimeout(timer);
  }, [events]);

  return events;
}
