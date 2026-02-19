import { useState } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenant } from '@/contexts/TenantContext';
import { useAvailableTenants, type AvailableTenant } from '@/hooks/useAvailableTenants';

export function TenantSwitcher() {
  const { tenant, switchTenant, loading: tenantLoading } = useTenant();
  const { tenants, loading: tenantsLoading } = useAvailableTenants();
  const [switching, setSwitching] = useState(false);

  // Don't show switcher if user only has access to one tenant
  if (tenantsLoading || tenants.length <= 1) {
    return null;
  }

  const handleSwitch = async (newTenantId: string) => {
    if (newTenantId === tenant?.id || switching) return;
    
    setSwitching(true);
    try {
      await switchTenant(newTenantId);
    } finally {
      setSwitching(false);
    }
  };

  const otherTenants = tenants.filter(t => t.tenant_id !== tenant?.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto text-left"
          disabled={switching || tenantLoading}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {tenant?.name || 'Carregando...'}
            </span>
          </div>
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-56 bg-popover border border-border shadow-lg z-50"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Trocar Empresa
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Current tenant */}
        <DropdownMenuItem disabled className="opacity-100">
          <Check className="h-4 w-4 mr-2 text-primary" />
          <span className="truncate">{tenant?.name}</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Other tenants */}
        {otherTenants.map((t) => (
          <DropdownMenuItem
            key={t.tenant_id}
            onClick={() => handleSwitch(t.tenant_id)}
            className="cursor-pointer"
          >
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="truncate">{t.tenant_name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

