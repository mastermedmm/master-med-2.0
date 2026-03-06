import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTablePagination } from '@/hooks/useTablePagination';
import { SearchableSelectWithId } from '@/components/ui/searchable-select-with-id';

interface NotaRejeitada {
  id: string;
  numero_dps: string | null;
  tomador_nome: string | null;
  tomador_documento: string | null;
  data_emissao: string | null;
  valor_servico: number;
  motivo_rejeicao: string | null;
  issuer_id: string | null;
  updated_at: string;
  issuers?: { name: string } | null;
}

export default function NfseRejeicoes() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { canRead } = usePermissions();

  const [notas, setNotas] = useState<NotaRejeitada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
        id, numero_dps, tomador_nome, tomador_documento, data_emissao,
        valor_servico, motivo_rejeicao, issuer_id, updated_at,
        issuers ( name )
      `)
      .eq('tenant_id', tenant.id)
      .eq('status', 'rejeitado' as any)
      .order('updated_at', { ascending: false });

    if (issuerFilter) {
      query = query.eq('issuer_id', issuerFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erro ao carregar rejeições', description: error.message, variant: 'destructive' });
    } else {
      setNotas((data as unknown as NotaRejeitada[]) || []);
    }
    setLoading(false);
  }, [tenant?.id, issuerFilter, toast]);

  useEffect(() => { loadNotas(); }, [loadNotas]);

  const filtered = notas.filter(n => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      n.numero_dps?.toLowerCase().includes(term) ||
      n.tomador_nome?.toLowerCase().includes(term) ||
      n.motivo_rejeicao?.toLowerCase().includes(term)
    );
  });

  const pagination = useTablePagination(filtered);
  const paginatedNotas = pagination.paginatedData as unknown as NotaRejeitada[];

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
          <h1 className="page-title">Rejeições</h1>
          <p className="page-description">Notas fiscais rejeitadas pela prefeitura</p>
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
                placeholder="Buscar por DPS, tomador, motivo..."
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
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5" />
            Rejeições ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma nota rejeitada encontrada.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DPS</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Data Rejeição</TableHead>
                    <TableHead className="min-w-[250px]">Motivo da Rejeição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNotas.map(nota => (
                    <TableRow key={nota.id}>
                      <TableCell className="text-sm font-medium">
                        {nota.numero_dps || '—'}
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
                      <TableCell className="text-sm">
                        {nota.data_emissao ? format(new Date(nota.data_emissao + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(nota.updated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-normal whitespace-normal text-left">
                          {nota.motivo_rejeicao || 'Motivo não informado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
