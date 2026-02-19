import { useTenant } from '@/contexts/TenantContext';
import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedBy, tenant, exitImpersonation } = useTenant();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-accent text-accent-foreground py-2 px-4 flex items-center justify-center gap-4 shadow-md">
      <AlertTriangle className="h-5 w-5" />
      <span className="font-medium">
        Você está acessando: <strong>{tenant?.name}</strong>
        {impersonatedBy && <span className="ml-2 opacity-80">(por {impersonatedBy})</span>}
      </span>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={exitImpersonation}
        className="border-accent-foreground/30 hover:bg-accent-foreground/10"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair do Tenant
      </Button>
    </div>
  );
}
