import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SuperAdmin {
  id: string;
  name: string;
  user_id: string;
}

interface SuperAdminAuthContextType {
  user: User | null;
  session: Session | null;
  superAdmin: SuperAdmin | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);

  const checkSuperAdmin = async (userId: string) => {
    const { data, error } = await supabase
      .from('super_admins')
      .select('id, name, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking super admin:', error);
      return null;
    }

    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const safeSetAdmin = (admin: SuperAdmin | null) => {
      if (!cancelled) setSuperAdmin(admin);
    };

    const fetchAndSetAdmin = async (userId: string) => {
      // Safety timeout so we never get stuck in a spinner.
      const timeoutId = window.setTimeout(() => {
        if (!cancelled) setAdminLoading(false);
      }, 8000);

      try {
        if (!cancelled) setAdminLoading(true);
        const adminData = await checkSuperAdmin(userId);
        safeSetAdmin(adminData);
      } catch (err) {
        console.error('Error checking super admin:', err);
        safeSetAdmin(null);
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setAdminLoading(false);
      }
    };

    // Listener FIRST (sync callback only)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (!nextSession?.user) {
        safeSetAdmin(null);
        setAdminLoading(false);
        return;
      }

      // Avoid doing async work inside the auth callback
      safeSetAdmin(null);
      setTimeout(() => {
        if (cancelled) return;
        void fetchAndSetAdmin(nextSession.user.id);
      }, 0);
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (cancelled) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (!currentSession?.user) {
        safeSetAdmin(null);
        setAdminLoading(false);
        return;
      }

      void fetchAndSetAdmin(currentSession.user.id);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSuperAdmin(null);
  };

  return (
    <SuperAdminAuthContext.Provider 
      value={{ 
        user, 
        session, 
        superAdmin, 
        loading: loading || adminLoading,
        isSuperAdmin: !!superAdmin,
        signIn, 
        signOut 
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
}

export function useSuperAdminAuth() {
  const context = useContext(SuperAdminAuthContext);
  if (context === undefined) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider');
  }
  return context;
}
