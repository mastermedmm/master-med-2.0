import { useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';

export function useDocumentTitle(pageTitle?: string) {
  const { tenant } = useTenant();
  
  useEffect(() => {
    const baseTitle = tenant?.name || 'MASTERSYSTEM';
    document.title = pageTitle 
      ? `${pageTitle} | ${baseTitle}` 
      : baseTitle;
    
    return () => {
      document.title = 'MASTERSYSTEM';
    };
  }, [tenant?.name, pageTitle]);
}
