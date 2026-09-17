import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { SUPABASE_ENABLED, supabase } from '../lib/supabase';

const DEMO_KEY = 'planstin-oe-demo-session';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSession(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) {
      // Demo mode: a locally stored "session" so the real sign-in flow can be
      // exercised before a Supabase project exists.
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) setUser(JSON.parse(raw) as AuthUser);
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(fromSession(data.session));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(fromSession(session));
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const demoSignIn = useCallback((email: string) => {
    const u: AuthUser = { id: `demo-${email.toLowerCase()}`, email: email.trim() };
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setUser(u);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signInWithPassword(email, password) {
        if (!SUPABASE_ENABLED || !supabase) {
          demoSignIn(email);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUpWithPassword(email, password, fullName) {
        if (!SUPABASE_ENABLED || !supabase) {
          demoSignIn(email);
          return { needsConfirmation: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (!SUPABASE_ENABLED || !supabase) {
          try {
            localStorage.removeItem(DEMO_KEY);
          } catch {
            /* ignore */
          }
          setUser(null);
          return;
        }
        await supabase.auth.signOut();
      },
    }),
    [user, loading, demoSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
