import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  FolderDown,
  Download,
  Eye,
  FileCode,
  FileText,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTablePagination } from '@/hooks/useTablePagination';

interface DocumentoNfse {
  id: string;
  nota_fiscal_id: string;
  tipo: string;
  nome_arquivo: string;
  storage_path: string | null;
  hash: string | null;
  tamanho_bytes: number | null;
  conteudo: string | null;
  created_at: string;
  notas_fiscais?: {
    numero_nfse: string | null;
    numero_dps: string | null;
    chave_acesso: string | null;
    status: string;
    tomador_nome: string | null;
    data_emissao: string | null;
    valor_servico: number;
  };
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  xml_dps: { label: 'XML DPS', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  xml_nfse: { label: 'XML NFS-e', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  xml_evento: { label: 'XML Evento', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  pdf_nfse: { label: 'PDF NFS-e', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  pdf_danfse: { label: 'PDF DANFSE', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function NfseDocumentos() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { canRead } = usePermissions();

  const [documentos, setDocumentos] = useState<DocumentoNfse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadDocumentos = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);

    let query = supabase
      .from('documentos_nfse')
      .select(`
        id, nota_fiscal_id, tipo, nome_arquivo, storage_path, hash, tamanho_bytes, conteudo, created_at,
        notas_fiscais!documentos_nfse_nota_fiscal_id_fkey (
          numero_nfse, numero_dps, chave_acesso, status, tomador_nome, data_emissao, valor_servico
        )
      `)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (tipoFilter !== 'todos') {
      query = query.eq('tipo', tipoFilter as any);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar documentos', description: error.message, variant: 'destructive' });
    } else {
      setDocumentos((data as unknown as DocumentoNfse[]) || []);
    }
    setLoading(false);
  }, [tenant?.id, tipoFilter, toast]);

  useEffect(() => { loadDocumentos(); }, [loadDocumentos]);

  const filteredDocs = documentos.filter(doc => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      doc.nome_arquivo.toLowerCase().includes(term) ||
      doc.notas_fiscais?.numero_nfse?.toLowerCase().includes(term) ||
      doc.notas_fiscais?.chave_acesso?.toLowerCase().includes(term) ||
      doc.notas_fiscais?.tomador_nome?.toLowerCase().includes(term) ||
      doc.notas_fiscais?.numero_dps?.toLowerCase().includes(term)
    );
  });

  const pagination = useTablePagination(filteredDocs);
  const paginatedDocs = pagination.paginatedData as unknown as DocumentoNfse[];

  const handleDownload = async (doc: DocumentoNfse) => {
    try {
      if (doc.storage_path) {
        const { data, error } = await supabase.storage
          .from('nfse-documentos')
          .download(doc.storage_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nome_arquivo;
        a.click();
        URL.revokeObjectURL(url);
      } else if (doc.conteudo) {
        const blob = new Blob([doc.conteudo], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nome_arquivo;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast({ title: 'Documento sem conteúdo disponível', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro ao baixar documento', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const handlePreview = async (doc: DocumentoNfse) => {
    setLoadingPreview(true);
    setPreviewTitle(doc.nome_arquivo);
    setPreviewOpen(true);

    try {
      if (doc.storage_path) {
        const { data, error } = await supabase.storage
          .from('nfse-documentos')
          .download(doc.storage_path);

        if (error) throw error;
        const text = await data.text();
        setPreviewContent(text);
      } else if (doc.conteudo) {
        setPreviewContent(doc.conteudo);
      } else {
        setPreviewContent('Conteúdo não disponível para visualização.');
      }
    } catch (err) {
      setPreviewContent('Erro ao carregar conteúdo do documento.');
    }
    setLoadingPreview(false);
  };

  if (!canRead('nfse.documentos')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para acessar os documentos.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Documentos Fiscais</h1>
          <p className="page-description">XML e PDF das notas fiscais emitidas — imutáveis e com integridade SHA-256</p>
        </div>
        <Button variant="outline" onClick={loadDocumentos} disabled={loading}>
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
                placeholder="Buscar por arquivo, nota, chave, tomador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="xml_dps">XML DPS</SelectItem>
                <SelectItem value="xml_nfse">XML NFS-e</SelectItem>
                <SelectItem value="xml_evento">XML Evento</SelectItem>
                <SelectItem value="pdf_nfse">PDF NFS-e</SelectItem>
                <SelectItem value="pdf_danfse">PDF DANFSE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Object.entries(TIPO_LABELS).map(([key, { label, color }]) => {
          const count = documentos.filter(d => d.tipo === key).length;
          return (
            <Card key={key} className="p-3">
              <div className="flex items-center gap-2">
                <Badge className={color}>{label}</Badge>
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
            <FolderDown className="h-5 w-5" />
            Documentos ({filteredDocs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum documento encontrado.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Nota / DPS</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Integridade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDocs.map(doc => {
                    const tipo = TIPO_LABELS[doc.tipo] || { label: doc.tipo, color: 'bg-muted text-muted-foreground' };
                    const isXml = doc.tipo.startsWith('xml');
                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge className={tipo.color}>{tipo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isXml ? <FileCode className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm font-medium truncate max-w-[200px]">{doc.nome_arquivo}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {doc.notas_fiscais?.numero_nfse && (
                              <p className="font-medium">{doc.notas_fiscais.numero_nfse}</p>
                            )}
                            {doc.notas_fiscais?.numero_dps && (
                              <p className="text-xs text-muted-foreground">{doc.notas_fiscais.numero_dps}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[150px] block">
                            {doc.notas_fiscais?.tomador_nome || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatBytes(doc.tamanho_bytes)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {doc.hash ? (
                            <div className="flex items-center gap-1" title={`SHA-256: ${doc.hash}`}>
                              <ShieldCheck className="h-4 w-4 text-green-600" />
                              <span className="text-xs text-muted-foreground font-mono">{doc.hash.substring(0, 8)}…</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {isXml && (
                              <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)} title="Visualizar">
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <Separator />
          {loadingPreview ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh] rounded-md border bg-muted/30 p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{previewContent}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
