import { useState } from 'react';
import { Building2, Loader2, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AvailableTenant } from '@/hooks/useAvailableTenants';

interface TenantSelectorProps {
  tenants: AvailableTenant[];
  onSelect: (tenantId: string) => Promise<void>;
  onBack: () => void;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  financeiro: 'Financeiro',
};

export function TenantSelector({ tenants, onSelect, onBack }: TenantSelectorProps) {
  const [selectingTenant, setSelectingTenant] = useState<string | null>(null);

  const handleSelect = async (tenantId: string) => {
    setSelectingTenant(tenantId);
    try {
      await onSelect(tenantId);
    } finally {
      setSelectingTenant(null);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Selecione a Empresa</h2>
        <p className="text-muted-foreground">
          Você tem acesso a múltiplas empresas. Escolha qual deseja acessar.
        </p>
      </div>

      <div className="space-y-3">
        {tenants.map((tenant) => (
          <Card
            key={tenant.tenant_id}
            className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${
              selectingTenant === tenant.tenant_id ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
            onClick={() => !selectingTenant && handleSelect(tenant.tenant_id)}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tenant.tenant_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{tenant.tenant_slug}</span>
                    <Badge variant="secondary" className="text-xs">
                      {roleLabels[tenant.user_role] || tenant.user_role}
                    </Badge>
                  </div>
                </div>
              </div>
              {selectingTenant === tenant.tenant_id ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={onBack}
        disabled={!!selectingTenant}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Voltar ao Login
      </Button>
    </div>
  );
}
