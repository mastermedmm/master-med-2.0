import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ClipboardList,
  Search,
  FileText,
  Send,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRightLeft,
  Eye,
  Code,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type EventoTipo = 'emissao' | 'rejeicao' | 'cancelamento' | 'substituicao' | 'alteracao' | 'reprocessamento' | 'autorizacao' | 'consulta';

interface EventoNfse {
  id: string;
  nota_fiscal_id: string;
  tenant_id: string;
  tipo: EventoTipo;
  descricao: string | null;
  mensagem: string | null;
  codigo_retorno: string | null;
  dados: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  created_at: string;
  notas_fiscais?: {
    numero_nfse: string | null;
    numero_dps: string | null;
    tomador_nome: string | null;
    status: string;
    chave_acesso: string | null;
  };
}

const EVENTO_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  emissao: { label: 'Emissão', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Send },
  autorizacao: { label: 'Autorização', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: FileText },
  rejeicao: { label: 'Rejeição', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: AlertTriangle },
  cancelamento: { label: 'Cancelamento', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: XCircle },
  substituicao: { label: 'Substituição', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: ArrowRightLeft },
  alteracao: { label: 'Alteração', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: RefreshCw },
  reprocessamento: { label: 'Reprocessamento', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200', icon: RefreshCw },
  consulta: { label: 'Consulta', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: Search },
};

const TIMELINE_COLORS: Record<string, string> = {
  emissao: 'border-blue-500 bg-blue-500',
  autorizacao: 'border-green-500 bg-green-500',
  rejeicao: 'border-red-500 bg-red-500',
  cancelamento: 'border-orange-500 bg-orange-500',
  substituicao: 'border-purple-500 bg-purple-500',
  alteracao: 'border-yellow-500 bg-yellow-500',
  reprocessamento: 'border-cyan-500 bg-cyan-500',
  consulta: 'border-gray-500 bg-gray-500',
};

const PAGE_SIZE = 20;

export default function NfseEventos() {
  const { canRead } = usePermissions();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedEvento, setSelectedEvento] = useState<EventoNfse | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('timeline');

  const hasPermission = canRead('nfse.eventos');

  const { data: eventos, isLoading } = useQuery({
    queryKey: ['nfse-eventos', search, tipoFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('eventos_nfse')
        .select(`
          *,
          notas_fiscais!inner (
            numero_nfse,
            numero_dps,
            tomador_nome,
            status,
            chave_acesso
          )
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (tipoFilter && tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter as "emissao" | "rejeicao" | "cancelamento" | "substituicao" | "autorizacao" | "reprocessamento" | "consulta" | "envio_dps" | "retorno_prefeitura");
      }

      if (search.trim()) {
        query = query.or(
          `descricao.ilike.%${search}%,mensagem.ilike.%${search}%,usuario_nome.ilike.%${search}%,notas_fiscais.numero_nfse.ilike.%${search}%,notas_fiscais.tomador_nome.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EventoNfse[];
    },
    enabled: hasPermission,
  });

  const { data: stats } = useQuery({
    queryKey: ['nfse-eventos-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eventos_nfse')
        .select('tipo');
      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((e) => {
        counts[e.tipo] = (counts[e.tipo] || 0) + 1;
      });
      return { total: data?.length || 0, byType: counts };
    },
    enabled: hasPermission,
  });

  if (!hasPermission) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Sem permissão para acessar eventos da NFS-e.</p>
        </div>
      </AppLayout>
    );
  }

  const getEventConfig = (tipo: string) => EVENTO_CONFIG[tipo] || EVENTO_CONFIG.consulta;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const notaLabel = (evento: EventoNfse) => {
    const nf = evento.notas_fiscais;
    if (!nf) return evento.nota_fiscal_id.slice(0, 8);
    return nf.numero_nfse || nf.numero_dps || evento.nota_fiscal_id.slice(0, 8);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Eventos da Nota</h1>
        <p className="page-description">Histórico completo de eventos das notas fiscais de serviço</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {Object.entries(EVENTO_CONFIG).slice(0, 6).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = stats?.byType[key] || 0;
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTipoFilter(tipoFilter === key ? 'all' : key)}>
              <CardContent className="p-3 flex items-center gap-2">
                <div className={`p-1.5 rounded ${cfg.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, nota, tomador..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(EVENTO_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 border rounded-md p-0.5">
              <Button size="sm" variant={viewMode === 'timeline' ? 'default' : 'ghost'} onClick={() => setViewMode('timeline')}>
                <ClipboardList className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={viewMode === 'table' ? 'default' : 'ghost'} onClick={() => setViewMode('table')}>
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !eventos?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum evento encontrado.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'timeline' ? (
        <div className="relative ml-4">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-6">
            {eventos.map((evento) => {
              const cfg = getEventConfig(evento.tipo);
              const Icon = cfg.icon;
              const dotColor = TIMELINE_COLORS[evento.tipo] || TIMELINE_COLORS.consulta;
              return (
                <div key={evento.id} className="relative pl-10">
                  <div className={`absolute left-1 top-2 w-5 h-5 rounded-full border-2 ${dotColor} flex items-center justify-center`}>
                    <div className="w-2 h-2 rounded-full bg-background" />
                  </div>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={cfg.color}>
                              <Icon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              Nota: {notaLabel(evento)}
                            </span>
                            {evento.notas_fiscais?.tomador_nome && (
                              <span className="text-xs text-muted-foreground truncate">
                                — {evento.notas_fiscais.tomador_nome}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground mt-1">
                            {evento.descricao || evento.mensagem || 'Sem descrição'}
                          </p>
                          {evento.codigo_retorno && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Código retorno: {evento.codigo_retorno}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(evento.created_at)}
                            </span>
                            {evento.usuario_nome && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {evento.usuario_nome}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedEvento(evento)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((evento) => {
                const cfg = getEventConfig(evento.tipo);
                const Icon = cfg.icon;
                return (
                  <TableRow key={evento.id}>
                    <TableCell>
                      <Badge className={cfg.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{notaLabel(evento)}</TableCell>
                    <TableCell className="text-muted-foreground">{evento.notas_fiscais?.tomador_nome || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{evento.descricao || evento.mensagem || '—'}</TableCell>
                    <TableCell>{evento.usuario_nome || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(evento.created_at)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setSelectedEvento(evento)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {eventos && eventos.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} · {eventos.length} evento(s)
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button size="sm" variant="outline" disabled={eventos.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvento} onOpenChange={() => setSelectedEvento(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes do Evento
              {selectedEvento && (
                <Badge className={getEventConfig(selectedEvento.tipo).color}>
                  {getEventConfig(selectedEvento.tipo).label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedEvento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nota Fiscal</p>
                  <p className="text-sm font-medium">{notaLabel(selectedEvento)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tomador</p>
                  <p className="text-sm">{selectedEvento.notas_fiscais?.tomador_nome || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data do Evento</p>
                  <p className="text-sm">{formatDate(selectedEvento.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p className="text-sm">{selectedEvento.usuario_nome || selectedEvento.usuario_id || '—'}</p>
                </div>
                {selectedEvento.codigo_retorno && (
                  <div>
                    <p className="text-xs text-muted-foreground">Código de Retorno</p>
                    <p className="text-sm font-mono">{selectedEvento.codigo_retorno}</p>
                  </div>
                )}
                {selectedEvento.notas_fiscais?.chave_acesso && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Chave de Acesso</p>
                    <p className="text-xs font-mono break-all">{selectedEvento.notas_fiscais.chave_acesso}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm bg-muted p-3 rounded-md">
                  {selectedEvento.descricao || '—'}
                </p>
              </div>

              {selectedEvento.mensagem && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedEvento.mensagem}</p>
                </div>
              )}

              {selectedEvento.dados && Object.keys(selectedEvento.dados).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Code className="h-3 w-3" /> Dados do Evento (JSON)
                  </p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 font-mono">
                    {JSON.stringify(selectedEvento.dados, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
