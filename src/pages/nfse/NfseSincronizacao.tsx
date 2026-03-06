import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  RefreshCw,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

interface SyncJob {
  id: string;
  tipo: string;
  status: string;
  tentativas: number;
  iniciado_em: string | null;
  finalizado_em: string | null;
  erro_ultima_tentativa: string | null;
  dados: Record<string, number> | null;
  created_at: string;
  created_by: string | null;
}

interface IntegracaoLog {
  id: string;
  operacao: string;
  sucesso: boolean;
  erro_mensagem: string | null;
  endpoint: string | null;
  duracao_ms: number | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pendente: { label: 'Pendente', icon: Clock, className: 'text-muted-foreground' },
  executando: { label: 'Executando', icon: RefreshCw, className: 'text-blue-600 animate-spin' },
  concluido: { label: 'Concluído', icon: CheckCircle2, className: 'text-green-600' },
  falha: { label: 'Falha', icon: XCircle, className: 'text-destructive' },
  cancelado: { label: 'Cancelado', icon: AlertTriangle, className: 'text-yellow-600' },
};

export default function NfseSincronizacao() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { canRead } = usePermissions();

  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [logs, setLogs] = useState<IntegracaoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);

    const [jobsRes, logsRes] = await Promise.all([
      supabase
        .from('jobs_sincronizacao_nfse')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('logs_integracao_nfse')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('operacao', 'sincronizacao_automatica')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setJobs((jobsRes.data as unknown as SyncJob[]) || []);
    setLogs((logsRes.data as unknown as IntegracaoLog[]) || []);
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleManualSync = async () => {
    if (!tenant?.id) return;
    setSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('nfse-sync', {
        body: { tenant_id: tenant.id },
      });

      if (error) {
        toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: 'Sincronização concluída',
          description: `${data?.total_atualizadas || 0} notas atualizadas, ${data?.total_erros || 0} erros`,
        });
        loadData();
      }
    } catch {
      toast({ title: 'Erro na sincronização', description: 'Erro inesperado', variant: 'destructive' });
    }

    setSyncing(false);
  };

  // Stats
  const lastSync = jobs.find(j => j.status === 'concluido');
  const runningSync = jobs.find(j => j.status === 'executando');
  const failedCount = jobs.filter(j => j.status === 'falha').length;
  const successCount = jobs.filter(j => j.status === 'concluido').length;

  if (!canRead('nfse.sincronizacao')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para acessar a sincronização.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Sincronização NFS-e</h1>
          <p className="page-description">Sincronização automática com a API do Sistema Nacional de NFS-e — execução a cada 1 hora</p>
        </div>
        <Button onClick={handleManualSync} disabled={syncing || !!runningSync}>
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Sincronizar Agora
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última Sincronização</p>
                <p className="text-sm font-semibold">
                  {lastSync?.finalizado_em
                    ? formatDistanceToNow(new Date(lastSync.finalizado_em), { addSuffix: true, locale: ptBR })
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sucessos</p>
                <p className="text-sm font-semibold">{successCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="text-sm font-semibold">{failedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-semibold">
                  {runningSync ? 'Em execução' : 'Aguardando'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Details */}
      {lastSync?.dados && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resultado da Última Sincronização
            </CardTitle>
            <CardDescription>
              {lastSync.finalizado_em && format(new Date(lastSync.finalizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 rounded-lg border">
                <p className="text-2xl font-bold">{lastSync.dados.total_notas ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Verificadas</p>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <p className="text-2xl font-bold text-green-600">{lastSync.dados.atualizadas ?? 0}</p>
                <p className="text-xs text-muted-foreground">Atualizadas</p>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <p className="text-2xl font-bold text-yellow-600">{lastSync.dados.canceladas ?? 0}</p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <p className="text-2xl font-bold text-blue-600">{lastSync.dados.substituidas ?? 0}</p>
                <p className="text-xs text-muted-foreground">Substituídas</p>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <p className="text-2xl font-bold text-destructive">{lastSync.dados.erros ?? 0}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs History */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Histórico de Execuções
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma execução registrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => {
                  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pendente;
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${config.className}`} />
                          <Badge variant="outline">{config.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{job.tipo}</TableCell>
                      <TableCell className="text-sm">
                        {job.iniciado_em
                          ? format(new Date(job.iniciado_em), 'dd/MM HH:mm:ss', { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.finalizado_em
                          ? format(new Date(job.finalizado_em), 'dd/MM HH:mm:ss', { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.dados ? (
                          <span>
                            {job.dados.atualizadas ?? 0} atualizadas, {job.dados.erros ?? 0} erros
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                        {job.erro_ultima_tentativa || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Integration Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Logs de Integração
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Nenhum log de sincronização registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.sucesso ? (
                        <Badge variant="outline" className="border-green-300 text-green-700">Sucesso</Badge>
                      ) : (
                        <Badge variant="destructive">Falha</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{log.operacao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{log.endpoint || '—'}</TableCell>
                    <TableCell className="text-sm">{log.duracao_ms ? `${log.duracao_ms}ms` : '—'}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm text-destructive truncate max-w-[200px]">{log.erro_mensagem || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
