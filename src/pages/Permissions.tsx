import { useState, useEffect } from 'react';
import { Loader2, Shield, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, type ModuleName, type AppRole } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Permission {
  id: string;
  role: AppRole;
  module_name: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_customize: boolean;
}

const MODULE_LABELS: Record<ModuleName, string> = {
  dashboard: 'Dashboard',
  import: 'Importar NF',
  allocation: 'Rateio',
  payables: 'Lançamentos',
  expenses: 'Despesas',
  doctors: 'Médicos',
  hospitals: 'Hospitais',
  issuers: 'Emitentes',
  banks: 'Bancos',
  statements: 'Importar Extrato',
  reconciliation: 'Conciliar Despesas',
  adjustments: 'Ajustes Recebimento',
  cashflow: 'Fluxo de Caixa',
  users: 'Usuários',
  permissions: 'Permissões',
  settings: 'Configurações',
  audit_logs: 'Log de Eventos',
};

const PERMISSION_LABELS = {
  can_create: 'Criar',
  can_read: 'Ler',
  can_update: 'Editar',
  can_delete: 'Excluir',
  can_customize: 'Personalizar',
};

export default function Permissions() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading: permLoading } = usePermissions();
  
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!permLoading && !isAdmin) {
      navigate(ROUTES.dashboard);
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive',
      });
    }
  }, [isAdmin, permLoading, navigate, toast]);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('module_permissions')
        .select('*')
        .order('role')
        .order('module_name');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error: any) {
      console.error('Error loading permissions:', error);
      toast({
        title: 'Erro ao carregar permissões',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (
    permissionId: string, 
    field: 'can_create' | 'can_read' | 'can_update' | 'can_delete' | 'can_customize'
  ) => {
    setPermissions(prev => 
      prev.map(p => 
        p.id === permissionId 
          ? { ...p, [field]: !p[field] }
          : p
      )
    );
    setHasChanges(true);
    setChangedIds(prev => new Set(prev).add(permissionId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update only changed permissions
      const changedPermissions = permissions.filter(p => changedIds.has(p.id));
      for (const perm of changedPermissions) {
        const { error } = await supabase
          .from('module_permissions')
          .update({
            can_create: perm.can_create,
            can_read: perm.can_read,
            can_update: perm.can_update,
            can_delete: perm.can_delete,
            can_customize: perm.can_customize,
          })
          .eq('id', perm.id);

        if (error) throw error;
      }

      toast({
        title: 'Permissões salvas',
        description: 'As alterações foram aplicadas com sucesso.',
      });
      setHasChanges(false);
      setChangedIds(new Set());
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by role
  const adminPermissions = permissions.filter(p => p.role === 'admin');
  const operadorPermissions = permissions.filter(p => p.role === 'operador');
  const financeiroPermissions = permissions.filter(p => p.role === 'financeiro');

  const PermissionTable = ({ 
    rolePermissions, 
    roleLabel 
  }: { 
    rolePermissions: Permission[]; 
    roleLabel: string;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant={roleLabel === 'Administrador' ? 'default' : 'secondary'}>
            {roleLabel}
          </Badge>
        </CardTitle>
        <CardDescription>
          Permissões para o perfil {roleLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <TableHead key={key} className="text-center w-24">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolePermissions.map(perm => (
                <TableRow key={perm.id}>
                  <TableCell className="font-medium">
                    {MODULE_LABELS[perm.module_name as ModuleName] || perm.module_name}
                  </TableCell>
                  {(['can_create', 'can_read', 'can_update', 'can_delete', 'can_customize'] as const).map(field => (
                    <TableCell key={field} className="text-center">
                      <Checkbox
                        checked={perm[field]}
                        onCheckedChange={() => handleToggle(perm.id, field)}
                        disabled={perm.role === 'admin' && perm.module_name === 'permissions'}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  if (permLoading || loading) {
    return (
      <AppLayout>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="page-title">Permissões</h1>
            <p className="page-description">Gerenciamento de permissões por módulo</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Permissões</h1>
          <p className="page-description">Gerencie as permissões de acesso por módulo para cada perfil de usuário</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            C = Criar, R = Ler, U = Editar, D = Excluir, P = Personalizar
          </span>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6">
        <PermissionTable rolePermissions={adminPermissions} roleLabel="Administrador" />
        <PermissionTable rolePermissions={operadorPermissions} roleLabel="Operador" />
        <PermissionTable rolePermissions={financeiroPermissions} roleLabel="Financeiro" />
      </div>
    </AppLayout>
  );
}
