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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useTableSort } from '@/hooks/useTableSort';
import { useTablePagination } from '@/hooks/useTablePagination';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  document: string | null;
  payer_cnpj_1: string | null;
  payer_cnpj_2: string | null;
}

const formatCNPJInput = (value: string) => {
  const cleaned = value.replace(/\D/g, "").slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export default function Hospitals() {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { sortedData, requestSort, getSortDirection } = useTableSort(hospitals);
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
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    payer_cnpj_1: '',
    payer_cnpj_2: '',
  });

  useEffect(() => {
    if (tenantId) {
      loadHospitals();
    }
  }, [tenantId]);

  const loadHospitals = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setHospitals(data || []);
    } catch (error: any) {
      console.error('Error loading hospitals:', error);
      toast({
        title: 'Erro ao carregar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (hospital?: Hospital) => {
    if (hospital) {
      setEditingHospital(hospital);
      setFormData({
        name: hospital.name,
        document: formatCNPJInput(hospital.document || ''),
        payer_cnpj_1: formatCNPJInput(hospital.payer_cnpj_1 || ''),
        payer_cnpj_2: formatCNPJInput(hospital.payer_cnpj_2 || ''),
      });
    } else {
      setEditingHospital(null);
      setFormData({ name: '', document: '', payer_cnpj_1: '', payer_cnpj_2: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({
        title: 'Nome obrigatório',
        description: 'Preencha o nome do hospital',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        name: formData.name,
        document: formData.document.replace(/\D/g, '') || null,
        payer_cnpj_1: formData.payer_cnpj_1.replace(/\D/g, '') || null,
        payer_cnpj_2: formData.payer_cnpj_2.replace(/\D/g, '') || null,
      };

      if (editingHospital) {
        const { error } = await supabase
          .from('hospitals')
          .update(data)
          .eq('id', editingHospital.id);

        if (error) throw error;

        await logEvent({
          action: 'UPDATE',
          tableName: 'hospitals',
          recordId: editingHospital.id,
          recordLabel: formData.name,
          oldData: editingHospital,
          newData: { ...editingHospital, ...data },
        });

        toast({ title: 'Hospital atualizado!' });
      } else {
        const { data: newHospital, error } = await supabase
          .from('hospitals')
          .insert({ ...data, tenant_id: tenantId })
          .select('id')
          .single();

        if (error) throw error;

        await logEvent({
          action: 'INSERT',
          tableName: 'hospitals',
          recordId: newHospital.id,
          recordLabel: formData.name,
          newData: { ...data, id: newHospital.id },
        });

        toast({ title: 'Hospital cadastrado!' });
      }

      setIsDialogOpen(false);
      loadHospitals();
    } catch (error: any) {
      console.error('Error saving hospital:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (hospital: Hospital) => {
    if (!confirm(`Deseja excluir o hospital ${hospital.name}?`)) return;

    try {
      const { error } = await supabase
        .from('hospitals')
        .delete()
        .eq('id', hospital.id);

      if (error) throw error;

      await logEvent({
        action: 'DELETE',
        tableName: 'hospitals',
        recordId: hospital.id,
        recordLabel: hospital.name,
        oldData: hospital,
      });

      toast({ title: 'Hospital excluído!' });
      loadHospitals();
    } catch (error: any) {
      console.error('Error deleting hospital:', error);
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
          <h1 className="page-title">Hospitais / Clientes</h1>
          <p className="page-description">Cadastro de hospitais e clientes</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Hospital
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : hospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Nenhum hospital cadastrado</p>
              <Button className="mt-4" onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeiro Hospital
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
                      sortDirection={getSortDirection('document')}
                      onSort={() => requestSort('document')}
                    >
                      Documento
                    </SortableTableHead>
                    <SortableTableHead sortable={false} className="w-[100px]"></SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((hospital) => (
                    <TableRow key={hospital.id}>
                      <TableCell className="font-medium">{hospital.name}</TableCell>
                      <TableCell className="font-mono">{hospital.document || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openDialog(hospital)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(hospital)}>
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
            <DialogTitle>{editingHospital ? 'Editar Hospital' : 'Novo Hospital'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do hospital
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Hospital Alpha"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="document">CNPJ</Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) => setFormData(prev => ({ ...prev, document: formatCNPJInput(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payer_cnpj_1">CNPJ Pagador 01 (opcional)</Label>
              <Input
                id="payer_cnpj_1"
                value={formData.payer_cnpj_1}
                onChange={(e) => setFormData(prev => ({ ...prev, payer_cnpj_1: formatCNPJInput(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payer_cnpj_2">CNPJ Pagador 02 (opcional)</Label>
              <Input
                id="payer_cnpj_2"
                value={formData.payer_cnpj_2}
                onChange={(e) => setFormData(prev => ({ ...prev, payer_cnpj_2: formatCNPJInput(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
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
