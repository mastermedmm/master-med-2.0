import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, Plus, Pencil, Trash2, Landmark, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

interface Bank {
  id: string;
  name: string;
  agency: string | null;
  account_number: string | null;
  initial_balance: number;
  created_at: string;
}

interface BankWithBalance extends Bank {
  currentBalance: number;
}

export default function Banks() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const [banks, setBanks] = useState<BankWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { sortedData, requestSort, getSortDirection } = useTableSort(banks);
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBank, setCurrentBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    agency: '',
    account_number: '',
    initial_balance: '',
  });

  useEffect(() => {
    if (tenantId) {
      loadBanks();
    }
  }, [tenantId]);

  const loadBanks = async () => {
    if (!tenantId) return;
    
    try {
      // Fetch banks, payments, expenses, revenues, and invoice_receipts in parallel
      const [banksResult, paymentsResult, expensesResult, revenuesResult, invoiceReceiptsResult] = await Promise.all([
        supabase.from('banks').select('*').eq('tenant_id', tenantId).order('name'),
        supabase.from('payments').select('id, bank_id, amount, reversed_at').eq('tenant_id', tenantId),
        supabase.from('expenses').select('id, bank_id, amount').eq('tenant_id', tenantId).eq('status', 'pago'),
        supabase.from('revenues').select('id, bank_id, amount, source').eq('tenant_id', tenantId),
        supabase.from('invoice_receipts').select('id, bank_id, amount, reversed_at').eq('tenant_id', tenantId)
      ]);

      if (banksResult.error) throw banksResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (revenuesResult.error) throw revenuesResult.error;
      if (invoiceReceiptsResult.error) throw invoiceReceiptsResult.error;

      const banksData = banksResult.data || [];
      const paymentsData = paymentsResult.data || [];
      const expensesData = expensesResult.data || [];
      const revenuesData = revenuesResult.data || [];
      const invoiceReceiptsData = invoiceReceiptsResult.data || [];

      // Calculate current balance for each bank
      const banksWithBalance: BankWithBalance[] = banksData.map(bank => {
        const bankPayments = paymentsData.filter(p => p.bank_id === bank.id);
        const bankExpenses = expensesData.filter(e => e.bank_id === bank.id);
        const bankRevenues = revenuesData.filter(r => r.bank_id === bank.id);
        const bankInvoiceReceipts = invoiceReceiptsData.filter(ir => ir.bank_id === bank.id);
        
        // Sum of non-reversed payments (money out)
        const totalPaid = bankPayments
          .filter(p => !p.reversed_at)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        
        // Reversed payments return money to the bank
        const totalReversed = bankPayments
          .filter(p => p.reversed_at)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        // Paid expenses (money out)
        const totalExpenses = bankExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Revenues (money in) - exclude reversal revenues to avoid double counting
        const totalRevenues = bankRevenues
          .filter(r => r.source !== 'estorno_pagamento')
          .reduce((sum, r) => sum + Number(r.amount), 0);

        // Invoice receipts (money in) - only non-reversed
        const totalInvoiceReceipts = bankInvoiceReceipts
          .filter(ir => !ir.reversed_at)
          .reduce((sum, ir) => sum + Number(ir.amount), 0);

        // Balance = Initial + Revenues + Invoice Receipts + Reversals - Payments - Expenses
        const currentBalance = Number(bank.initial_balance) + totalRevenues + totalInvoiceReceipts + totalReversed - totalPaid - totalExpenses;

        return {
          ...bank,
          currentBalance
        };
      });

      setBanks(banksWithBalance);
    } catch (error: any) {
      console.error('Error loading banks:', error);
      toast({
        title: 'Erro ao carregar bancos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const openDialog = (bank?: Bank) => {
    if (bank) {
      setIsEditing(true);
      setCurrentBank(bank);
      setFormData({
        name: bank.name,
        agency: bank.agency || '',
        account_number: bank.account_number || '',
        initial_balance: bank.initial_balance.toString(),
      });
    } else {
      setIsEditing(false);
      setCurrentBank(null);
      setFormData({
        name: '',
        agency: '',
        account_number: '',
        initial_balance: '0',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do banco é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      const bankData = {
        name: formData.name.trim(),
        agency: formData.agency.trim() || null,
        account_number: formData.account_number.trim() || null,
        initial_balance: parseFloat(formData.initial_balance) || 0,
      };

      if (isEditing && currentBank) {
        const { error } = await supabase
          .from('banks')
          .update(bankData)
          .eq('id', currentBank.id);

        if (error) throw error;

        await logEvent({
          action: 'UPDATE',
          tableName: 'banks',
          recordId: currentBank.id,
          recordLabel: bankData.name,
          oldData: currentBank,
          newData: { ...currentBank, ...bankData },
        });

        toast({
          title: 'Banco atualizado!',
          description: `${bankData.name} foi atualizado com sucesso`,
        });
      } else {
        const { data: newBank, error } = await supabase
          .from('banks')
          .insert({ ...bankData, tenant_id: tenantId })
          .select('id')
          .single();

        if (error) throw error;

        await logEvent({
          action: 'INSERT',
          tableName: 'banks',
          recordId: newBank.id,
          recordLabel: bankData.name,
          newData: { ...bankData, id: newBank.id },
        });

        toast({
          title: 'Banco cadastrado!',
          description: `${bankData.name} foi cadastrado com sucesso`,
        });
      }

      setDialogOpen(false);
      loadBanks();
    } catch (error: any) {
      console.error('Error saving bank:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (bank: Bank) => {
    if (!confirm(`Deseja realmente excluir o banco "${bank.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', bank.id);

      if (error) {
        if (error.message.includes('violates foreign key constraint')) {
          throw new Error('Este banco possui pagamentos vinculados e não pode ser excluído');
        }
        throw error;
      }

      await logEvent({
        action: 'DELETE',
        tableName: 'banks',
        recordId: bank.id,
        recordLabel: bank.name,
        oldData: bank,
      });

      toast({
        title: 'Banco excluído!',
        description: `${bank.name} foi excluído com sucesso`,
      });

      loadBanks();
    } catch (error: any) {
      console.error('Error deleting bank:', error);
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
          <h1 className="page-title">Bancos</h1>
          <p className="page-description">Gerencie as contas bancárias</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Banco
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Bancos</CardTitle>
          <CardDescription>
            Contas bancárias cadastradas para movimentação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : banks.length === 0 ? (
            <div className="py-8 text-center">
              <Landmark className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhum banco cadastrado</h3>
              <p className="mt-2 text-muted-foreground">
                Cadastre um banco para registrar pagamentos
              </p>
              <Button className="mt-4" onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Banco
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
                      sortDirection={getSortDirection('agency')}
                      onSort={() => requestSort('agency')}
                    >
                      Agência
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('account_number')}
                      onSort={() => requestSort('account_number')}
                    >
                      Conta
                    </SortableTableHead>
                    <SortableTableHead sortable={false} className="w-[150px]">Ações</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">{bank.name}</TableCell>
                      <TableCell>{bank.agency || '-'}</TableCell>
                      <TableCell>{bank.account_number || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(ROUTES.bankStatement(bank.id))}
                            title="Ver Extrato"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(bank)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(bank)}
                          >
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Banco' : 'Novo Banco'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Atualize os dados do banco' : 'Cadastre uma nova conta bancária'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Banco do Brasil"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="agency">Agência</Label>
                <Input
                  id="agency"
                  value={formData.agency}
                  onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                  placeholder="0001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account">Conta</Label>
                <Input
                  id="account"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="12345-6"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="initial_balance">Saldo Inicial</Label>
              <Input
                id="initial_balance"
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
