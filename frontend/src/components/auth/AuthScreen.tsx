import React, { useState } from "react";
import type { Me } from "../../types/game";
import { api } from "../../services/api";
import { Swords, LogIn, UserPlus, UserRound, Loader2 } from "lucide-react";

type Mode = "login" | "register" | "guest";

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: "login", label: "Ingresar", icon: <LogIn className="w-4 h-4" /> },
  {
    id: "register",
    label: "Crear cuenta",
    icon: <UserPlus className="w-4 h-4" />,
  },
  { id: "guest", label: "Invitado", icon: <UserRound className="w-4 h-4" /> },
];

export const AuthScreen: React.FC<{ onAuthenticated: (me: Me) => void }> = ({
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const me =
        mode === "login"
          ? await api.login(username, password)
          : mode === "register"
            ? await api.register(username, password)
            : await api.guest(guestName);
      onAuthenticated(me);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40";

  return (
    <div className="h-full flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,rgba(51,65,85,0.35),rgba(2,6,23,1)_70%)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <Swords className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-black tracking-wide text-white">
            TEG GO
          </h1>
          <p className="text-sm text-slate-400">
            Plan Táctico y Estratégico de la Guerra
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-3 border-b border-slate-800">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setError(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition ${
                  mode === m.id
                    ? "text-amber-400 bg-slate-800/60 shadow-[inset_0_-2px_0_#f59e0b]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="p-5 space-y-3">
            {mode === "guest" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-400">
                    Nombre para mostrar
                  </span>
                  <input
                    autoFocus
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={20}
                    placeholder="Comandante"
                    className={input}
                  />
                </label>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Como invitado podés jugar y mirar partidas, pero no vas a
                  poder retomarlas después de cerrar el navegador.
                </p>
              </>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-400">
                    Usuario
                  </span>
                  <input
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={20}
                    className={input}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-400">
                    Contraseña
                  </span>
                  <input
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={input}
                  />
                </label>
                {mode === "register" && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-400">
                      Repetir contraseña
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      className={input}
                    />
                  </label>
                )}
                {mode === "register" && (
                  <p className="text-xs text-slate-500">
                    3 a 20 letras, números o _. Contraseña de 6 caracteres o
                    más.
                  </p>
                )}
              </>
            )}

            {error && (
              <p className="text-sm text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold py-2.5 rounded-lg transition"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login"
                ? "Ingresar"
                : mode === "register"
                  ? "Crear cuenta"
                  : "Entrar como invitado"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
