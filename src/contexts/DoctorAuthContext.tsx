import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Doctor {
  id: string;
  name: string;
  crm: string;
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

interface DoctorAuthContextType {
  doctor: Doctor | null;
  tenant: Tenant | null;
  loading: boolean;
  mustChangePassword: boolean;
  login: (crm: string, password: string, tenantId?: string) => Promise<LoginResult>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const DoctorAuthContext = createContext<DoctorAuthContextType | undefined>(undefined);

const SESSION_KEY = 'doctor_portal_session';

export function DoctorAuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    validateSession();
  }, []);

  const getSessionToken = () => {
    return localStorage.getItem(SESSION_KEY);
  };

  const setSessionToken = (token: string | null) => {
    if (token) {
      localStorage.setItem(SESSION_KEY, token);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const validateSession = async () => {
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('doctor-auth/validate-session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error || !data?.valid) {
        setSessionToken(null);
        setDoctor(null);
        setTenant(null);
      } else {
        setDoctor(data.doctor);
        setTenant(data.tenant || null);
        setMustChangePassword(data.mustChangePassword || false);
      }
    } catch (error) {
      console.error('Error validating session:', error);
      setSessionToken(null);
      setDoctor(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (crm: string, password: string, tenantId?: string): Promise<LoginResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('doctor-auth/login', {
        body: { crm, password, tenantId },
      });

      if (error) {
        console.error('Login error:', error);
        return { error: 'Erro ao fazer login. Tente novamente.' };
      }

      if (data?.error) {
        return { error: data.error };
      }

      // Check if tenant selection is required
      if (data?.requiresTenantSelection) {
        return {
          error: null,
          requiresTenantSelection: true,
          tenants: data.tenants,
        };
      }

      if (data?.token) {
        setSessionToken(data.token);
        setDoctor(data.doctor);
        setTenant(data.tenant || null);
        setMustChangePassword(data.mustChangePassword || false);
        return { error: null, mustChangePassword: data.mustChangePassword };
      }

      return { error: 'Resposta inesperada do servidor' };
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Erro ao fazer login. Tente novamente.' };
    }
  };

  const changePassword = async (newPassword: string) => {
    const token = getSessionToken();
    if (!token) {
      return { error: 'Sessão inválida' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('doctor-auth/change-password', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { newPassword },
      });

      if (error) {
        console.error('Change password error:', error);
        return { error: 'Erro ao alterar senha. Tente novamente.' };
      }

      if (data?.error) {
        return { error: data.error };
      }

      if (data?.success) {
        setMustChangePassword(false);
        return { error: null };
      }

      return { error: 'Resposta inesperada do servidor' };
    } catch (error) {
      console.error('Change password error:', error);
      return { error: 'Erro ao alterar senha. Tente novamente.' };
    }
  };

  const logout = async () => {
    const token = getSessionToken();
    if (token) {
      try {
        await supabase.functions.invoke('doctor-auth/logout', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    setSessionToken(null);
    setDoctor(null);
    setTenant(null);
    setMustChangePassword(false);
  };

  return (
    <DoctorAuthContext.Provider value={{ doctor, tenant, loading, mustChangePassword, login, changePassword, logout }}>
      {children}
    </DoctorAuthContext.Provider>
  );
}

export function useDoctorAuth() {
  const context = useContext(DoctorAuthContext);
  if (context === undefined) {
    throw new Error('useDoctorAuth must be used within a DoctorAuthProvider');
  }
  return context;
}
