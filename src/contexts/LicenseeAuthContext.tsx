import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Licensee {
  id: string;
  name: string;
  cpf: string;
  commission: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface LoginResult {
  error: string | null;
  mustChangePassword?: boolean;
  requiresTenantSelection?: boolean;
  tenants?: TenantOption[];
}

interface LicenseeAuthContextType {
  licensee: Licensee | null;
  tenant: Tenant | null;
  loading: boolean;
  mustChangePassword: boolean;
  login: (cpf: string, password: string, tenantId?: string) => Promise<LoginResult>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const LicenseeAuthContext = createContext<LicenseeAuthContextType | undefined>(undefined);

const SESSION_KEY = 'licensee_portal_session';

export function LicenseeAuthProvider({ children }: { children: ReactNode }) {
  const [licensee, setLicensee] = useState<Licensee | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    validateSession();
  }, []);

  const getSessionToken = () => localStorage.getItem(SESSION_KEY);

  const setSessionToken = (token: string | null) => {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  };

  const validateSession = async () => {
    const token = getSessionToken();
    if (!token) { setLoading(false); return; }

    try {
      const { data, error } = await supabase.functions.invoke('licensee-auth/validate-session', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.valid) {
        setSessionToken(null);
        setLicensee(null);
        setTenant(null);
      } else {
        setLicensee(data.licensee);
        setTenant(data.tenant || null);
        setMustChangePassword(data.mustChangePassword || false);
      }
    } catch {
      setSessionToken(null);
      setLicensee(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (cpf: string, password: string, tenantId?: string): Promise<LoginResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('licensee-auth/login', {
        body: { cpf, password, tenantId },
      });

      if (error) return { error: 'Erro ao fazer login. Tente novamente.' };
      if (data?.error) return { error: data.error };

      if (data?.requiresTenantSelection) {
        return { error: null, requiresTenantSelection: true, tenants: data.tenants };
      }

      if (data?.token) {
        setSessionToken(data.token);
        setLicensee(data.licensee);
        setTenant(data.tenant || null);
        setMustChangePassword(data.mustChangePassword || false);
        return { error: null, mustChangePassword: data.mustChangePassword };
      }

      return { error: 'Resposta inesperada do servidor' };
    } catch {
      return { error: 'Erro ao fazer login. Tente novamente.' };
    }
  };

  const changePassword = async (newPassword: string) => {
    const token = getSessionToken();
    if (!token) return { error: 'Sessão inválida' };

    try {
      const { data, error } = await supabase.functions.invoke('licensee-auth/change-password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { newPassword },
      });

      if (error || data?.error) return { error: data?.error || 'Erro ao alterar senha.' };
      if (data?.success) { setMustChangePassword(false); return { error: null }; }
      return { error: 'Resposta inesperada do servidor' };
    } catch {
      return { error: 'Erro ao alterar senha.' };
    }
  };

  const logout = async () => {
    const token = getSessionToken();
    if (token) {
      try {
        await supabase.functions.invoke('licensee-auth/logout', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    setSessionToken(null);
    setLicensee(null);
    setTenant(null);
    setMustChangePassword(false);
  };

  return (
    <LicenseeAuthContext.Provider value={{ licensee, tenant, loading, mustChangePassword, login, changePassword, logout }}>
      {children}
    </LicenseeAuthContext.Provider>
  );
}

export function useLicenseeAuth() {
  const context = useContext(LicenseeAuthContext);
  if (context === undefined) throw new Error('useLicenseeAuth must be used within a LicenseeAuthProvider');
  return context;
}
