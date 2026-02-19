import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/super-admin/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { 
  Plus, 
  Search, 
  Building2, 
  Loader2,
  ExternalLink,
  Edit,
  Users,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

export default function TenantsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenantToDelete, setTenantToDelete] = useState<{ id: string; name: string } | null>(null);
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['super-admin-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Get invoice counts per tenant
  const { data: invoiceCounts } = useQuery({
    queryKey: ['super-admin-invoice-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('tenant_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(inv => {
        if (inv.tenant_id) {
          counts[inv.tenant_id] = (counts[inv.tenant_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Delete tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants-list'] });
      toast.success('Empresa excluída com sucesso');
      setTenantToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting tenant:', error);
      toast.error('Erro ao excluir empresa. Verifique se não há dados vinculados.');
    },
  });

  const filteredTenants = tenants?.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      (tenant.document && tenant.document.toLowerCase().includes(search.toLowerCase()));
    const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  }) || [];

  const { sortedData: sortedTenants, requestSort, getSortDirection } = useTableSort(filteredTenants);

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-tenant', {
        body: { tenant_id: tenantId }
      });

      if (error) throw error;

      const appUrl = `${window.location.origin}?impersonate=${data.token}`;
      window.open(appUrl, '_blank');
      
      toast.success(`Acessando ${tenantName}`);
    } catch (error) {
      console.error('Impersonation error:', error);
      toast.error('Erro ao acessar empresa');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/15 text-success hover:bg-success/20">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'suspended':
        return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      trial: 'bg-muted text-muted-foreground',
      basic: 'bg-primary/15 text-primary',
      pro: 'bg-warning/15 text-warning',
      enterprise: 'bg-success/15 text-success',
    };
    return (
      <Badge className={colors[plan] || 'bg-muted'}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="page-header mb-0">
            <h1 className="page-title">Empresas</h1>
            <p className="page-description">
              Gerencie todas as empresas cadastradas na plataforma
            </p>
          </div>
          <Button asChild>
            <Link to="/super-admin/tenants/new">
              <Plus className="mr-2 h-4 w-4" />
              Nova Empresa
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os planos</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Lista de Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedTenants.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma empresa encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      sortDirection={getSortDirection('name')}
                      onSort={() => requestSort('name')}
                    >
                      Nome
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('slug')}
                      onSort={() => requestSort('slug')}
                    >
                      Slug
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('plan')}
                      onSort={() => requestSort('plan')}
                    >
                      Plano
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('status')}
                      onSort={() => requestSort('status')}
                    >
                      Status
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('max_users')}
                      onSort={() => requestSort('max_users')}
                      className="text-center"
                    >
                      <Users className="h-4 w-4 inline mr-1" />
                      Máx. Usuários
                    </SortableTableHead>
                    <SortableTableHead sortable={false} className="text-center">Notas</SortableTableHead>
                    <SortableTableHead sortable={false} className="text-right">Ações</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell className="text-muted-foreground">{tenant.slug}</TableCell>
                      <TableCell>{getPlanBadge(tenant.plan)}</TableCell>
                      <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                      <TableCell className="text-center">{tenant.max_users}</TableCell>
                      <TableCell className="text-center">
                        {invoiceCounts?.[tenant.id] || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link to={`/super-admin/tenants/${tenant.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImpersonate(tenant.id, tenant.name)}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Acessar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setTenantToDelete({ id: tenant.id, name: tenant.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{tenantToDelete?.name}</strong>?
              <br /><br />
              Esta ação é irreversível e irá remover todos os dados associados (usuários, notas, médicos, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => tenantToDelete && deleteTenantMutation.mutate(tenantToDelete.id)}
              disabled={deleteTenantMutation.isPending}
            >
              {deleteTenantMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
