import React from 'react';

// Un dado del sorteo de turnos (los chicos son los de desempate)
export const Die: React.FC<{ value: number; small?: boolean; dim?: boolean }> = ({ value, small, dim }) => (
  <span
    className={`rounded-lg flex items-center justify-center font-black shadow bg-slate-100 text-slate-900 transition ${
      small ? 'w-7 h-7 text-sm' : 'w-10 h-10 text-xl'
    } ${dim ? 'opacity-40' : ''}`}
  >
    {value}
  </span>
);
