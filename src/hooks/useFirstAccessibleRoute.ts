import { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { primaryNav, financialNav, registrationNav, adminNav, nfseNav, juridicoNav } from '@/config/navigation';

/**
 * Returns the first route the user has permission to access.
 * Useful for redirecting users who don't have dashboard access.
 */
export function useFirstAccessibleRoute(): string | null {
  const { hasAnyPermission, permissions } = usePermissions();

  return useMemo(() => {
    if (permissions.length === 0) return null;

    const allNavItems = [
      ...primaryNav,
      ...financialNav,
      ...registrationNav,
      ...adminNav,
      ...nfseNav,
      ...juridicoNav,
    ];

    for (const item of allNavItems) {
      if (!item.module) return item.to;
      if (hasAnyPermission(item.module)) return item.to;
    }

    return null;
  }, [hasAnyPermission, permissions]);
}
