import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { FileUp, FileCheck, Clock, CheckCircle, CreditCard, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalInvoices: number;
  pendingReceipts: number;
  receivedTotal: number;
  pendingPayables: number;
  paidTotal: number;
}

export default function Dashboard() {
  const { tenantId } = useTenant();
  const [stats, setStats] = useState<DashboardStats>({
    totalInvoices: 0,
    pendingReceipts: 0,
    receivedTotal: 0,
    pendingPayables: 0,
    paidTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadStats();
    }
  }, [tenantId]);

  async function loadStats() {
    if (!tenantId) return;
    
    try {
      const [invoicesRes, payablesRes] = await Promise.all([
        supabase.from('invoices').select('id, status, net_value').eq('tenant_id', tenantId),
        supabase.from('accounts_payable').select('id, status, amount_to_pay').eq('tenant_id', tenantId),
      ]);

      const invoices = invoicesRes.data || [];
      const payables = payablesRes.data || [];

      setStats({
        totalInvoices: invoices.length,
        pendingReceipts: invoices.filter(i => i.status === 'pendente').length,
        receivedTotal: invoices
          .filter(i => i.status === 'recebido')
          .reduce((sum, i) => sum + Number(i.net_value), 0),
        pendingPayables: payables.filter(p => p.status === 'pendente' || p.status === 'aguardando_recebimento').length,
        paidTotal: payables
          .filter(p => p.status === 'pago')
          .reduce((sum, p) => sum + Number(p.amount_to_pay), 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Visão geral do sistema de importação de notas</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 flex gap-4">
        <Button asChild>
          <Link to={ROUTES.import}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar PDF
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.payables}>
            <CreditCard className="mr-2 h-4 w-4" />
            Contas a Pagar
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Notas
            </CardTitle>
            <FileCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalInvoices}</div>
            <p className="mt-1 text-sm text-muted-foreground">Notas importadas</p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aguardando Recebimento
            </CardTitle>
            <Clock className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingReceipts}</div>
            <p className="mt-1 text-sm text-muted-foreground">Notas pendentes do hospital</p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recebido
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats.receivedTotal)}</div>
            <p className="mt-1 text-sm text-muted-foreground">Valor líquido recebido</p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pagamentos Pendentes
            </CardTitle>
            <CreditCard className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingPayables}</div>
            <p className="mt-1 text-sm text-muted-foreground">Médicos aguardando pagamento</p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pago a Médicos
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats.paidTotal)}</div>
            <p className="mt-1 text-sm text-muted-foreground">Valor total pago (85%)</p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Guide */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Fluxo de Trabalho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {[
              { step: 1, name: 'Importar', icon: FileUp, href: ROUTES.import },
              { step: 2, name: 'Ratear', icon: TrendingUp, href: ROUTES.allocation },
              { step: 3, name: 'Receber', icon: CheckCircle, href: ROUTES.payables },
              { step: 4, name: 'Pagar', icon: CreditCard, href: ROUTES.payables },
            ].map((item, index) => (
              <div key={item.step} className="flex items-center">
                <Link
                  to={item.href}
                  className="flex flex-col items-center gap-2 rounded-lg p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
                {index < 3 && (
                  <div className="mx-2 h-px w-8 bg-border" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
