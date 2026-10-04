import React from 'react';
import { BookOpen, X } from 'lucide-react';

// Reglas tal como las aplica el server (ver server/internal/game)
const SECTIONS: { title: string; items: React.ReactNode[] }[] = [
  {
    title: 'Objetivo',
    items: [
      'Cada jugador recibe una misión secreta al empezar. Gana el primero que la cumple.',
      'También gana quien ocupe 30 países, o quien elimine a todos sus rivales.',
    ],
  },
  {
    title: 'Comienzo',
    items: [
      'Los países se reparten al azar con 1 ejército cada uno.',
      'Hay dos rondas de colocación inicial: primero 5 ejércitos y después 3, en tus propios países.',
    ],
  },
  {
    title: 'Turno',
    items: [
      <>
        <b>Canje:</b> podés canjear 3 tarjetas por ejércitos extra (o saltear el canje).
      </>,
      <>
        <b>Incorporar:</b> recibís la mitad de tus países (mínimo 3), más el bonus de cada continente completo, y
        los colocás en tus países.
      </>,
      <>
        <b>Atacar:</b> atacás países vecinos todas las veces que quieras.
      </>,
      <>
        <b>Reagrupar:</b> movés ejércitos entre países propios limítrofes y terminás el turno.
      </>,
    ],
  },
  {
    title: 'Ataque',
    items: [
      'Para atacar el país de origen necesita al menos 2 ejércitos. El atacante tira un dado por ejército menos uno (máximo 3); el defensor, uno por ejército (máximo 3).',
      'Se comparan los dados de mayor a menor: el más bajo pierde un ejército. En caso de empate gana el defensor.',
      'Si el defensor se queda sin ejércitos, conquistás el país y pasás entre 1 y 3 ejércitos (siempre queda 1 en el origen).',
      'Si eliminás a un jugador, te quedás con sus tarjetas.',
    ],
  },
  {
    title: 'Reagrupar',
    items: [
      'Cada país puede mover todos sus ejércitos menos 1 a un país propio limítrofe.',
      'Los ejércitos que llegan a un país durante el reagrupe ya no se pueden volver a mover ese turno.',
    ],
  },
  {
    title: 'Tarjetas',
    items: [
      'Si conquistaste al menos un país en tu turno, al terminarlo recibís una tarjeta de país.',
      'Si tenés la tarjeta de un país que es tuyo, podés cobrarla una vez y recibís 2 ejércitos en ese país (si ya era tuyo al recibirla, se cobra sola).',
      'Canje: 3 tarjetas con la misma figura, 3 figuras distintas, o cualquier trío con comodín.',
      'Cada canje da más ejércitos: 4, 7, 10, 15, 20 y después 5 más por canje.',
    ],
  },
];

const CONTINENTS: [string, number][] = [
  ['Asia', 7],
  ['América del Norte', 5],
  ['Europa', 5],
  ['América del Sur', 3],
  ['África', 3],
  ['Oceanía', 2],
];

export const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
        <BookOpen className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-bold text-white">Reglas del TEG</h3>
        <button onClick={onClose} aria-label="Cerrar" className="ml-auto text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-y-auto px-6 py-4 space-y-5 text-sm text-slate-300">
        {SECTIONS.map((s) => (
          <section key={s.title} className="space-y-1.5">
            <h4 className="text-xs uppercase tracking-wider font-bold text-amber-400">{s.title}</h4>
            <ul className="list-disc pl-5 space-y-1">
              {s.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="space-y-1.5">
          <h4 className="text-xs uppercase tracking-wider font-bold text-amber-400">Bonus por continente</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {CONTINENTS.map(([name, bonus]) => (
              <div key={name} className="flex justify-between bg-slate-950/60 rounded-md px-2.5 py-1.5">
                <span>{name}</span>
                <span className="font-bold text-white">+{bonus}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  </div>
);
