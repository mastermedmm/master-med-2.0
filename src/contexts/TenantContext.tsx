import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  email: string;
  phone: string | null;
  plan: string;
  status: string;
  max_users: number;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  isImpersonating: boolean;
  impersonatedBy: string | null;
  exitImpersonation: () => void;
  refetchTenant: () => Promise<void>;
  switchTenant: (newTenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null);

  const fetchTenant = async () => {
    if (!user) {
      setTenant(null);
      setLoading(false);
      return;
    }

    try {
      // Check for impersonation token in URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const impersonationToken = urlParams.get('impersonate') || localStorage.getItem('impersonation_token');
      
      if (impersonationToken) {
        // Validate impersonation token via edge function
        const { data: impersonationData, error: impersonationError } = await supabase.functions.invoke(
          'validate-impersonation',
          { body: { token: impersonationToken } }
        );
        
        if (!impersonationError && impersonationData?.valid) {
          setIsImpersonating(true);
          setImpersonatedBy(impersonationData.super_admin_name);
          localStorage.setItem('impersonation_token', impersonationToken);
          
          // Remove from URL if present
          if (urlParams.has('impersonate')) {
            urlParams.delete('impersonate');
            const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
            window.history.replaceState({}, '', newUrl);
          }
          
          // Fetch the impersonated tenant
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', impersonationData.tenant_id)
            .maybeSingle();
          
          setTenant(tenantData);
          setLoading(false);
          return;
        } else {
          // Invalid token, clear it
          localStorage.removeItem('impersonation_token');
        }
      }

      // Normal flow: get active_tenant_id from profile first, fallback to tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, active_tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const effectiveTenantId = profile?.active_tenant_id || profile?.tenant_id;

      if (effectiveTenantId) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', effectiveTenantId)
          .maybeSingle();

        setTenant(tenantData);
      } else {
        // If no tenant in profile, try to get from user_roles
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (roleData?.tenant_id) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', roleData.tenant_id)
            .maybeSingle();

          setTenant(tenantData);
        }
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = async (newTenantId: string) => {
    if (!user) return;

    try {
      // Update active_tenant_id in profile
      const { error } = await supabase
        .from('profiles')
        .update({ active_tenant_id: newTenantId })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error switching tenant:', error);
        return;
      }

      // Reload the page to ensure all data is refreshed with new tenant context
      window.location.reload();
    } catch (error) {
      console.error('Error switching tenant:', error);
    }
  };

  const exitImpersonation = () => {
    localStorage.removeItem('impersonation_token');
    setIsImpersonating(false);
    setImpersonatedBy(null);
    setTenant(null);
    // Refresh to reload tenant from profile
    window.location.href = '/';
  };

  useEffect(() => {
    fetchTenant();
  }, [user]);

  return (
    <TenantContext.Provider 
      value={{ 
        tenant, 
        tenantId: tenant?.id || null, 
        loading, 
        isImpersonating,
        impersonatedBy,
        exitImpersonation,
        refetchTenant: fetchTenant,
        switchTenant
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
