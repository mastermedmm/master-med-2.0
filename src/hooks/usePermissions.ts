import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type ModuleName = 
  | 'dashboard' 
  | 'import' 
  | 'allocation' 
  | 'payables' 
  | 'expenses'
  | 'doctors' 
  | 'hospitals' 
  | 'issuers'
  | 'banks' 
  | 'statements'
  | 'reconciliation'
  | 'adjustments'
  | 'cashflow'
  | 'users' 
  | 'permissions'
  | 'settings'
  | 'audit_logs';

export type AppRole = 'admin' | 'operador' | 'financeiro';

interface ModulePermission {
  module_name: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_customize: boolean;
}

interface PermissionsData {
  role: AppRole | null;
  permissions: ModulePermission[];
}

interface UsePermissionsReturn {
  role: AppRole | null;
  loading: boolean;
  permissions: ModulePermission[];
  canCreate: (module: ModuleName) => boolean;
  canRead: (module: ModuleName) => boolean;
  canUpdate: (module: ModuleName) => boolean;
  canDelete: (module: ModuleName) => boolean;
  canCustomize: (module: ModuleName) => boolean;
  hasAnyPermission: (module: ModuleName) => boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
}

async function fetchPermissions(userId: string): Promise<PermissionsData> {
  // Fetch profile to get tenant_id (prefer active_tenant_id over tenant_id)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id, active_tenant_id')
    .eq('user_id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return { role: null, permissions: [] };
  }

  const userTenantId = profileData?.active_tenant_id || profileData?.tenant_id;

  // Fetch user role
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (roleError) {
    console.error('Error fetching role:', roleError);
    return { role: null, permissions: [] };
  }

  const userRole = roleData?.role as AppRole;

  // Fetch permissions for this role AND tenant
  let query = supabase
    .from('module_permissions')
    .select('module_name, can_create, can_read, can_update, can_delete, can_customize')
    .eq('role', userRole);
  
  if (userTenantId) {
    query = query.eq('tenant_id', userTenantId);
  }

  const { data: permData, error: permError } = await query;

  if (permError) {
    console.error('Error fetching permissions:', permError);
    return { role: userRole, permissions: [] };
  }

  return {
    role: userRole,
    permissions: permData || [],
  };
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => fetchPermissions(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000,   // 10 minutes - keep in cache
  });

  const role = data?.role ?? null;
  const permissions = data?.permissions ?? [];

  const getPermission = useCallback((module: ModuleName): ModulePermission | undefined => {
    return permissions.find(p => p.module_name === module);
  }, [permissions]);

  const canCreate = useCallback((module: ModuleName): boolean => {
    const perm = getPermission(module);
    return perm?.can_create ?? false;
  }, [getPermission]);

  const canRead = useCallback((module: ModuleName): boolean => {
    const perm = getPermission(module);
    return perm?.can_read ?? false;
  }, [getPermission]);

  const canUpdate = useCallback((module: ModuleName): boolean => {
    const perm = getPermission(module);
    return perm?.can_update ?? false;
  }, [getPermission]);

  const canDelete = useCallback((module: ModuleName): boolean => {
    const perm = getPermission(module);
    return perm?.can_delete ?? false;
  }, [getPermission]);

  const canCustomize = useCallback((module: ModuleName): boolean => {
    const perm = getPermission(module);
    return perm?.can_customize ?? false;
  }, [getPermission]);

  const hasAnyPermission = useCallback((module: ModuleName): boolean => {
    const perm = getPermission(module);
    if (!perm) return false;
    return perm.can_create || perm.can_read || perm.can_update || perm.can_delete || perm.can_customize;
  }, [getPermission]);

  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    role,
    loading: isLoading,
    permissions,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canCustomize,
    hasAnyPermission,
    isAdmin: role === 'admin',
    refetch: handleRefetch,
  };
}
