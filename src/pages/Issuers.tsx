import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useTableSort } from '@/hooks/useTableSort';
import { useTablePagination } from '@/hooks/useTablePagination';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Plus, Pencil, Trash2, Loader2, Factory } from 'lucide-react';

interface Issuer {
  id: string;
  name: string;
  cnpj: string;
  state: string;
  city: string;
  iss_rate: number;
  active: boolean;
}

const ESTADOS = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const formatIssRate = (value: string): string => {
  const numericValue = value.replace(/\D/g, '');
  const number = parseInt(numericValue, 10) / 100;
  if (number > 100) return '100,00';
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Issuers() {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { sortedData, requestSort, getSortDirection } = useTableSort(issuers);
  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
  } = useTablePagination(sortedData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIssuer, setEditingIssuer] = useState<Issuer | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    state: '',
    city: '',
    issRate: '',
  });

  useEffect(() => {
    if (tenantId) {
      loadIssuers();
    }
  }, [tenantId]);

  const loadIssuers = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('issuers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setIssuers(data || []);
    } catch (error: any) {
      console.error('Error loading issuers:', error);
      toast({
        title: 'Erro ao carregar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (issuer?: Issuer) => {
    if (issuer) {
      setEditingIssuer(issuer);
      setFormData({
        name: issuer.name,
        cnpj: formatCNPJ(issuer.cnpj),
        state: issuer.state,
        city: issuer.city,
        issRate: issuer.iss_rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      });
    } else {
      setEditingIssuer(null);
      setFormData({ name: '', cnpj: '', state: '', city: '', issRate: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cnpj || !formData.state || !formData.city) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const cnpjClean = formData.cnpj.replace(/\D/g, '');
    if (cnpjClean.length !== 14) {
      toast({
        title: 'CNPJ inválido',
        description: 'O CNPJ deve ter 14 dígitos',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const issRate = parseFloat(formData.issRate.replace(/\./g, '').replace(',', '.')) || 0;
      
      const data = {
        name: formData.name,
        cnpj: cnpjClean,
        state: formData.state,
        city: formData.city,
        iss_rate: issRate,
      };

      if (editingIssuer) {
        const { error } = await supabase
          .from('issuers')
          .update(data)
          .eq('id', editingIssuer.id);

        if (error) throw error;

        await logEvent({
          action: 'UPDATE',
          tableName: 'issuers',
          recordId: editingIssuer.id,
          recordLabel: data.name,
          oldData: editingIssuer,
          newData: { ...editingIssuer, ...data },
        });

        toast({ title: 'Emitente atualizado!' });
      } else {
        const { data: newIssuer, error } = await supabase
          .from('issuers')
          .insert({ ...data, tenant_id: tenantId })
          .select('id')
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('Já existe um emitente com este CNPJ');
          }
          throw error;
        }

        await logEvent({
          action: 'INSERT',
          tableName: 'issuers',
          recordId: newIssuer.id,
          recordLabel: data.name,
          newData: { ...data, id: newIssuer.id },
        });

        toast({ title: 'Emitente cadastrado!' });
      }

      setIsDialogOpen(false);
      loadIssuers();
    } catch (error: any) {
      console.error('Error saving issuer:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (issuer: Issuer) => {
    if (!confirm(`Deseja excluir o emitente ${issuer.name}?`)) return;

    try {
      const { error } = await supabase
        .from('issuers')
        .delete()
        .eq('id', issuer.id);

      if (error) throw error;

      await logEvent({
        action: 'DELETE',
        tableName: 'issuers',
        recordId: issuer.id,
        recordLabel: issuer.name,
        oldData: issuer,
      });

      toast({ title: 'Emitente excluído!' });
      loadIssuers();
    } catch (error: any) {
      console.error('Error deleting issuer:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Emitentes</h1>
          <p className="page-description">Cadastro de empresas emissoras de notas fiscais</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Emitente
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : issuers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Factory className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Nenhum emitente cadastrado</p>
              <p className="text-sm text-muted-foreground">Emitentes são cadastrados automaticamente ao importar XML</p>
              <Button className="mt-4" onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Emitente
              </Button>
            </div>
          ) : (
            <>
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
                      sortDirection={getSortDirection('cnpj')}
                      onSort={() => requestSort('cnpj')}
                    >
                      CNPJ
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('city')}
                      onSort={() => requestSort('city')}
                    >
                      Cidade/UF
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('iss_rate')}
                      onSort={() => requestSort('iss_rate')}
                      className="text-right"
                    >
                      Alíquota ISS
                    </SortableTableHead>
                    <SortableTableHead sortable={false} className="w-[100px]"></SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((issuer) => (
                    <TableRow key={issuer.id}>
                      <TableCell className="font-medium">{issuer.name}</TableCell>
                      <TableCell className="font-mono">{formatCNPJ(issuer.cnpj)}</TableCell>
                      <TableCell>{issuer.city}/{issuer.state}</TableCell>
                      <TableCell className="text-right font-mono">
                        {issuer.iss_rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openDialog(issuer)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(issuer)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalItems > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  onPageChange={goToPage}
                  onNextPage={nextPage}
                  onPrevPage={prevPage}
                  onFirstPage={firstPage}
                  onLastPage={lastPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIssuer ? 'Editar Emitente' : 'Novo Emitente'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do emitente
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Razão Social"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="state">Estado (UF) *</Label>
                <Select 
                  value={formData.state} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((estado) => (
                      <SelectItem key={estado.uf} value={estado.uf}>
                        {estado.uf} - {estado.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Nome da cidade"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issRate">Alíquota ISS (%)</Label>
              <Input
                id="issRate"
                value={formData.issRate}
                onChange={(e) => setFormData(prev => ({ ...prev, issRate: formatIssRate(e.target.value) }))}
                placeholder="0,00"
                className="w-32"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
