import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AvailableTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: 'admin' | 'operador' | 'financeiro';
}

export function useAvailableTenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<AvailableTenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    if (!user) {
      setTenants([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_accessible_tenants', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error fetching accessible tenants:', error);
        setTenants([]);
      } else {
        setTenants((data as AvailableTenant[]) || []);
      }
    } catch (error) {
      console.error('Error fetching accessible tenants:', error);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [user]);

  return { tenants, loading, refetch: fetchTenants };
}
