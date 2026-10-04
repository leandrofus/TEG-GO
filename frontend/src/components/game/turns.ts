import { useEffect, useState } from 'react';
import type { GameBoard } from '../../types/game';

// Próximo jugador vivo después de index (los eliminados no juegan)
export const nextAliveIndex = (board: GameBoard, index: number): number => {
  const n = board.turnOrder.length;
  for (let k = 1; k <= n; k++) {
    const i = (index + k) % n;
    if (board.players[board.turnOrder[i]]?.isAlive) return i;
  }
  return index;
};

// Cuánto ruedan los dados antes de mostrar cada ronda de tiradas
const ROLL_MS = 1100;

// Animación del sorteo: las tiradas ya vienen del server; acá se revelan de a
// una ronda (primer dado, después cada desempate). Mientras no terminó, face
// es la cara que muestran los dados que están rodando.
export function useDiceReveal(stages: number, animate: boolean) {
  const [shown, setShown] = useState(animate ? 0 : stages);
  const [face, setFace] = useState(1);
  const done = shown >= stages;

  useEffect(() => {
    if (done) return;
    const spin = setInterval(() => setFace(Math.floor(Math.random() * 6) + 1), 80);
    const reveal = setTimeout(() => setShown((n) => n + 1), ROLL_MS);
    return () => {
      clearInterval(spin);
      clearTimeout(reveal);
    };
  }, [shown, done]);

  return { shown, face, done };
}
