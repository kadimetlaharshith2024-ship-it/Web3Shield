import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { User } from "../lib/types";

/**
 * The backend has no sessions or tokens yet: /login only returns the profile.
 * So the "session" here is that profile saved in localStorage. It is a convenience,
 * NOT security. Add JWT/cookies on the backend before protecting anything real.
 */
export type Session = { kind: "user"; user: User } | { kind: "guest" } | null;

interface AuthValue {
  session: Session;
  user: User | null;
  signIn: (user: User) => void;
  continueAsGuest: () => void;
  signOut: () => void;
}

const KEY = "w3s.session.v1";
const Ctx = createContext<AuthValue | null>(null);

function load(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(load);

  const persist = useCallback((s: Session) => {
    setSession(s);
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.kind === "user" ? session.user : null,
      signIn: (user) => persist({ kind: "user", user }),
      continueAsGuest: () => persist({ kind: "guest" }),
      signOut: () => persist(null),
    }),
    [session, persist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
