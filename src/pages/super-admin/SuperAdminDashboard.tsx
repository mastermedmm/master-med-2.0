import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/super-admin/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Building2, 
  Loader2,
  ExternalLink,
  Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TenantRevenue {
  id: string;
  name: string;
  status: string;
  total_invoices: number;
  total_gross: number;
  total_net: number;
}

export default function SuperAdminDashboard() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));

  // Fetch all tenants
  const { data: tenants } = useQuery({
    queryKey: ['super-admin-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, status')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoices for the period
  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['super-admin-invoices', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('tenant_id, gross_value, net_value')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate);
      
      if (error) throw error;
      return data;
    },
  });

  // Calculate revenue per tenant
  const tenantRevenues: TenantRevenue[] = useMemo(() => {
    if (!tenants || !invoices) return [];

    return tenants.map(tenant => {
      const tenantInvoices = invoices.filter(inv => inv.tenant_id === tenant.id);
      return {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        total_invoices: tenantInvoices.length,
        total_gross: tenantInvoices.reduce((sum, inv) => sum + Number(inv.gross_value || 0), 0),
        total_net: tenantInvoices.reduce((sum, inv) => sum + Number(inv.net_value || 0), 0),
      };
    }).sort((a, b) => b.total_gross - a.total_gross);
  }, [tenants, invoices]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      gross: tenantRevenues.reduce((sum, t) => sum + t.total_gross, 0),
      net: tenantRevenues.reduce((sum, t) => sum + t.total_net, 0),
      invoices: tenantRevenues.reduce((sum, t) => sum + t.total_invoices, 0),
      activeCompanies: tenantRevenues.filter(t => t.status === 'active').length,
    };
  }, [tenantRevenues]);

  const handleFilter = () => {
    refetch();
  };

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-tenant', {
        body: { tenant_id: tenantId }
      });

      if (error) throw error;

      // Open the tenant app in a new tab with the impersonation token
      const appUrl = `${window.location.origin}?impersonate=${data.token}`;
      window.open(appUrl, '_blank');
      
      toast.success(`Acessando ${tenantName}`);
    } catch (error) {
      console.error('Impersonation error:', error);
      toast.error('Erro ao acessar empresa');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  return (
    <SuperAdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Dashboard de Faturamento</h1>
          <p className="page-description">
            Acompanhe o faturamento consolidado de todas as empresas
          </p>
        </div>

        {/* Date Filter */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={handleFilter} disabled={isLoading}>
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Faturamento Bruto
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.gross)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.invoices} notas no período
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Faturamento Líquido
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.net)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Após impostos e deduções
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Notas
              </CardTitle>
              <FileText className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.invoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Notas fiscais importadas
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Empresas Ativas
              </CardTitle>
              <Building2 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.activeCompanies}</div>
              <p className="text-xs text-muted-foreground mt-1">
                De {tenants?.length || 0} cadastradas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue by Company */}
        <Card>
          <CardHeader>
            <CardTitle>Faturamento por Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tenantRevenues.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma empresa cadastrada
              </div>
            ) : (
              <div className="space-y-4">
                {tenantRevenues.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tenant.name}</span>
                          {getStatusBadge(tenant.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tenant.total_invoices} notas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Bruto</p>
                        <p className="font-medium">{formatCurrency(tenant.total_gross)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Líquido</p>
                        <p className="font-medium">{formatCurrency(tenant.total_net)}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImpersonate(tenant.id, tenant.name)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Acessar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
