import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileCheck, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTablePagination } from '@/hooks/useTablePagination';
import { SearchableSelectWithId } from '@/components/ui/searchable-select-with-id';

interface NotaFiscal {
  id: string;
  numero_nfse: string | null;
  numero_dps: string | null;
  chave_acesso: string | null;
  status: string;
  tomador_nome: string | null;
  tomador_documento: string | null;
  data_emissao: string | null;
  data_autorizacao: string | null;
  valor_servico: number;
  valor_liquido: number;
  valor_iss: number;
  issuer_id: string | null;
  issuers?: { name: string } | null;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  fila_emissao: { label: 'Na Fila', variant: 'outline' },
  enviado: { label: 'Enviado', variant: 'outline' },
  autorizado: { label: 'Autorizado', variant: 'default' },
  rejeitado: { label: 'Rejeitado', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export default function NfseNotasEmitidas() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { canRead } = usePermissions();
  

  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [issuers, setIssuers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from('issuers').select('id, name').eq('tenant_id', tenant.id).eq('active', true).order('name')
      .then(({ data }) => setIssuers(data || []));
  }, [tenant?.id]);

  const loadNotas = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);

    let query = supabase
      .from('notas_fiscais')
      .select(`
        id, numero_nfse, numero_dps, chave_acesso, status, tomador_nome, tomador_documento,
        data_emissao, data_autorizacao, valor_servico, valor_liquido, valor_iss, issuer_id,
        issuers ( name )
      `)
      .eq('tenant_id', tenant.id)
      .neq('status', 'rascunho' as any)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'todos') {
      query = query.eq('status', statusFilter as any);
    }
    if (issuerFilter) {
      query = query.eq('issuer_id', issuerFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erro ao carregar notas', description: error.message, variant: 'destructive' });
    } else {
      setNotas((data as unknown as NotaFiscal[]) || []);
    }
    setLoading(false);
  }, [tenant?.id, statusFilter, issuerFilter, toast]);

  useEffect(() => { loadNotas(); }, [loadNotas]);

  const filtered = notas.filter(n => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      n.numero_nfse?.toLowerCase().includes(term) ||
      n.numero_dps?.toLowerCase().includes(term) ||
      n.chave_acesso?.toLowerCase().includes(term) ||
      n.tomador_nome?.toLowerCase().includes(term) ||
      n.tomador_documento?.toLowerCase().includes(term)
    );
  });

  const pagination = useTablePagination(filtered);
  const paginatedNotas = pagination.paginatedData as unknown as NotaFiscal[];

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!canRead('nfse.emitir')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Notas Emitidas</h1>
          <p className="page-description">Consulta de notas fiscais de serviço emitidas</p>
        </div>
        <Button variant="outline" onClick={loadNotas} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, chave, tomador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <SearchableSelectWithId
              options={issuers}
              value={issuerFilter}
              onValueChange={setIssuerFilter}
              placeholder="Emitente"
              searchPlaceholder="Buscar emitente..."
              emptyMessage="Nenhum emitente."
              allLabel="Todos emitentes"
              className="w-[220px]"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="fila_emissao">Na Fila</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="autorizado">Autorizado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {['autorizado', 'rejeitado', 'fila_emissao', 'cancelado'].map(s => {
          const info = STATUS_MAP[s];
          const count = notas.filter(n => n.status === s).length;
          return (
            <Card key={s} className="p-3">
              <div className="flex items-center gap-2">
                <Badge variant={info.variant}>{info.label}</Badge>
                <span className="text-lg font-semibold">{count}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-5 w-5" />
            Notas ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma nota encontrada.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>NFS-e / DPS</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead className="text-right">Valor Serviço</TableHead>
                    <TableHead className="text-right">ISS</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Data Emissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNotas.map(nota => {
                    const st = STATUS_MAP[nota.status] || { label: nota.status, variant: 'outline' as const };
                    return (
                      <TableRow key={nota.id}>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {nota.numero_nfse && <p className="font-medium">{nota.numero_nfse}</p>}
                            {nota.numero_dps && <p className="text-xs text-muted-foreground">{nota.numero_dps}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[150px] block">
                            {(nota.issuers as any)?.name || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[150px] block">
                            {nota.tomador_nome || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmtCurrency(nota.valor_servico)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtCurrency(nota.valor_iss)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtCurrency(nota.valor_liquido)}</TableCell>
                        <TableCell className="text-sm">
                          {nota.data_emissao ? format(new Date(nota.data_emissao + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                onPageChange={pagination.goToPage}
                onNextPage={pagination.nextPage}
                onPrevPage={pagination.prevPage}
                onFirstPage={pagination.firstPage}
                onLastPage={pagination.lastPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
