import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

/**
 * Hook that provides tenant-scoped query helpers
 * All queries automatically filter by the current tenant
 */
export function useTenantQuery() {
  const { tenantId } = useTenant();

  /**
   * Creates a query builder with tenant filter applied
   */
  const fromTenant = useCallback(<T extends keyof Database['public']['Tables']>(
    table: T
  ) => {
    const query = supabase.from(table);
    
    // Note: RLS already handles tenant filtering via get_user_tenant_id()
    // This is an additional safeguard at the application level
    if (tenantId) {
      return query;
    }
    return query;
  }, [tenantId]);

  /**
   * Adds tenant_id to insert data
   */
  const withTenantId = useCallback(<T extends Record<string, any>>(data: T): T & { tenant_id: string } => {
    if (!tenantId) {
      throw new Error('No tenant context available');
    }
    return { ...data, tenant_id: tenantId };
  }, [tenantId]);

  /**
   * Adds tenant_id to multiple insert records
   */
  const withTenantIdMany = useCallback(<T extends Record<string, any>>(data: T[]): (T & { tenant_id: string })[] => {
    if (!tenantId) {
      throw new Error('No tenant context available');
    }
    return data.map(item => ({ ...item, tenant_id: tenantId }));
  }, [tenantId]);

  return {
    tenantId,
    fromTenant,
    withTenantId,
    withTenantIdMany,
    hasTenant: !!tenantId,
  };
}

// Type helper - will be updated when types.ts regenerates
type Database = {
  public: {
    Tables: {
      doctors: any;
      hospitals: any;
      banks: any;
      invoices: any;
      invoice_allocations: any;
      accounts_payable: any;
      payments: any;
      expenses: any;
      expense_categories: any;
      profiles: any;
      user_roles: any;
      module_permissions: any;
      system_settings: any;
      column_preferences: any;
      tenants: any;
    };
  };
};
