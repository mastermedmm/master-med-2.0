import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { 
  FileText, AlertTriangle, XCircle, ArrowLeftRight, AlertOctagon,
  TrendingUp, Building2, MapPin, Bell, Wifi, RotateCcw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(var(--accent))',
];

function KpiCard({ title, value, icon: Icon, variant = 'default', loading }: {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  loading?: boolean;
}) {
  const colorMap = {
    default: 'text-primary',
    destructive: 'text-destructive',
    warning: 'text-yellow-600 dark:text-yellow-400',
    success: 'text-green-600 dark:text-green-400',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1">{value}</p>
            )}
          </div>
          <div className={`p-3 rounded-full bg-muted ${colorMap[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NfseDashboard() {
  const { canRead } = usePermissions();

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
  const last30 = format(subDays(today, 30), 'yyyy-MM-dd');

  // KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['nfse-dashboard-kpis', todayStr],
    queryFn: async () => {
      const [emitidas, rejeitadas, canceladas, substituidas] = await Promise.all([
        supabase.from('notas_fiscais').select('id', { count: 'exact', head: true })
          .gte('data_emissao', todayStr).lte('data_emissao', todayStr)
          .in('status', ['autorizado', 'enviado', 'fila_emissao']),
        supabase.from('notas_fiscais').select('id', { count: 'exact', head: true })
          .eq('status', 'rejeitado'),
        supabase.from('notas_fiscais').select('id', { count: 'exact', head: true })
          .eq('status', 'cancelado'),
        supabase.from('notas_fiscais').select('id', { count: 'exact', head: true })
          .eq('status', 'substituido'),
      ]);
      return {
        emitidas: emitidas.count ?? 0,
        rejeitadas: rejeitadas.count ?? 0,
        canceladas: canceladas.count ?? 0,
        substituidas: substituidas.count ?? 0,
      };
    },
    enabled: canRead('nfse.dashboard'),
  });

  // Emissões por dia (últimos 30 dias)
  const { data: emissoesPorDia } = useQuery({
    queryKey: ['nfse-emissoes-dia', last30],
    queryFn: async () => {
      const { data } = await supabase
        .from('notas_fiscais')
        .select('data_emissao, id')
        .gte('data_emissao', last30)
        .in('status', ['autorizado', 'enviado', 'fila_emissao', 'rejeitado']);

      const grouped: Record<string, number> = {};
      (data ?? []).forEach(n => {
        const d = n.data_emissao ?? '';
        grouped[d] = (grouped[d] || 0) + 1;
      });

      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({
          date: format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
          emissoes: count,
        }));
    },
    enabled: canRead('nfse.dashboard'),
  });

  // Emissões por município (mês atual)
  const { data: emissoesPorMunicipio } = useQuery({
    queryKey: ['nfse-emissoes-municipio', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('notas_fiscais')
        .select('municipio_nome, id')
        .gte('data_emissao', monthStart)
        .lte('data_emissao', monthEnd)
        .not('municipio_nome', 'is', null);

      const grouped: Record<string, number> = {};
      (data ?? []).forEach(n => {
        const m = n.municipio_nome ?? 'Não informado';
        grouped[m] = (grouped[m] || 0) + 1;
      });

      return Object.entries(grouped)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));
    },
    enabled: canRead('nfse.dashboard'),
  });

  // Emissões por tomador/empresa (mês atual)
  const { data: emissoesPorEmpresa } = useQuery({
    queryKey: ['nfse-emissoes-empresa', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('notas_fiscais')
        .select('tomador_nome, id')
        .gte('data_emissao', monthStart)
        .lte('data_emissao', monthEnd)
        .not('tomador_nome', 'is', null);

      const grouped: Record<string, number> = {};
      (data ?? []).forEach(n => {
        const name = n.tomador_nome ?? 'Não informado';
        grouped[name] = (grouped[name] || 0) + 1;
      });

      return Object.entries(grouped)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + '…' : name, value }));
    },
    enabled: canRead('nfse.dashboard'),
  });

  // Alertas
  const { data: alertas } = useQuery({
    queryKey: ['nfse-dashboard-alertas'],
    queryFn: async () => {
      const [rejeitadas, falhasIntegracao, errosSinc] = await Promise.all([
        supabase.from('notas_fiscais').select('id, numero_dps, tomador_nome, motivo_rejeicao')
          .eq('status', 'rejeitado').order('updated_at', { ascending: false }).limit(5),
        supabase.from('logs_integracao_nfse').select('id, operacao, erro_mensagem, created_at')
          .eq('sucesso', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('jobs_sincronizacao_nfse').select('id, tipo, erro_ultima_tentativa, updated_at')
          .eq('status', 'falha').order('updated_at', { ascending: false }).limit(5),
      ]);
      return {
        rejeitadas: rejeitadas.data ?? [],
        falhasIntegracao: falhasIntegracao.data ?? [],
        errosSinc: errosSinc.data ?? [],
      };
    },
    enabled: canRead('nfse.dashboard'),
  });

  if (!canRead('nfse.dashboard')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Sem permissão para acessar este módulo.</p>
        </div>
      </AppLayout>
    );
  }

  const chartConfigLine = { emissoes: { label: 'Emissões', color: 'hsl(var(--primary))' } };
  const chartConfigBar = { value: { label: 'Notas', color: 'hsl(var(--primary))' } };
  const chartConfigPie = { value: { label: 'Notas' } };

  const totalAlertas = (alertas?.rejeitadas.length ?? 0) + (alertas?.falhasIntegracao.length ?? 0) + (alertas?.errosSinc.length ?? 0);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">NFS-e — Dashboard</h1>
        <p className="page-description">
          Visão geral do módulo de Nota Fiscal de Serviço Eletrônica — {format(today, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Emitidas hoje" value={kpis?.emitidas ?? 0} icon={FileText} loading={kpisLoading} />
        <KpiCard title="Rejeitadas" value={kpis?.rejeitadas ?? 0} icon={XCircle} variant="destructive" loading={kpisLoading} />
        <KpiCard title="Canceladas" value={kpis?.canceladas ?? 0} icon={AlertTriangle} variant="warning" loading={kpisLoading} />
        <KpiCard title="Substituídas" value={kpis?.substituidas ?? 0} icon={ArrowLeftRight} loading={kpisLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Emissões por dia */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Emissões por dia (últimos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emissoesPorDia && emissoesPorDia.length > 0 ? (
              <ChartContainer config={chartConfigLine} className="h-[260px] w-full">
                <LineChart data={emissoesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="emissoes" stroke="var(--color-emissoes)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados de emissões nos últimos 30 dias.</p>
            )}
          </CardContent>
        </Card>

        {/* Emissões por empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Emissões por empresa (mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emissoesPorEmpresa && emissoesPorEmpresa.length > 0 ? (
              <ChartContainer config={chartConfigBar} className="h-[260px] w-full">
                <BarChart data={emissoesPorEmpresa} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados de emissões neste mês.</p>
            )}
          </CardContent>
        </Card>

        {/* Emissões por município */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Emissões por município (mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emissoesPorMunicipio && emissoesPorMunicipio.length > 0 ? (
              <ChartContainer config={chartConfigPie} className="h-[260px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={emissoesPorMunicipio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={11}>
                    {emissoesPorMunicipio.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados de municípios neste mês.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Alertas
            {totalAlertas > 0 && <Badge variant="destructive">{totalAlertas}</Badge>}
          </CardTitle>
          <CardDescription>Problemas que precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalAlertas === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta no momento. ✅</p>
          )}

          {(alertas?.rejeitadas ?? []).map(n => (
            <Alert key={n.id} variant="destructive">
              <AlertOctagon className="h-4 w-4" />
              <AlertTitle className="text-sm">Nota rejeitada — DPS {n.numero_dps || '—'}</AlertTitle>
              <AlertDescription className="text-xs">
                {n.tomador_nome && <span className="font-medium">{n.tomador_nome} — </span>}
                {n.motivo_rejeicao || 'Sem motivo informado'}
              </AlertDescription>
            </Alert>
          ))}

          {(alertas?.falhasIntegracao ?? []).map(l => (
            <Alert key={l.id}>
              <Wifi className="h-4 w-4" />
              <AlertTitle className="text-sm">Falha de integração — {l.operacao}</AlertTitle>
              <AlertDescription className="text-xs">
                {l.erro_mensagem || 'Erro desconhecido'} — {l.created_at ? format(new Date(l.created_at), 'dd/MM HH:mm') : ''}
              </AlertDescription>
            </Alert>
          ))}

          {(alertas?.errosSinc ?? []).map(j => (
            <Alert key={j.id}>
              <RotateCcw className="h-4 w-4" />
              <AlertTitle className="text-sm">Erro de sincronização — {j.tipo}</AlertTitle>
              <AlertDescription className="text-xs">
                {j.erro_ultima_tentativa || 'Erro desconhecido'} — {j.updated_at ? format(new Date(j.updated_at), 'dd/MM HH:mm') : ''}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
