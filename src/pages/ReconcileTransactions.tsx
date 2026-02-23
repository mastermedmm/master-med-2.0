import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useImportedTransactions, ImportedTransaction, ReconciliationSuggestion } from "@/hooks/useImportedTransactions";
import { CategorySelectorWithCreate } from "@/components/reconciliation/InlineCategoryCreator";
import { MultiInvoiceSelector, SelectedInvoice } from "@/components/reconciliation/MultiInvoiceSelector";
import { PayableSelector } from "@/components/reconciliation/PayableSelector";
import { Textarea } from "@/components/ui/textarea";
import { 
  Check, 
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Link2,
  Plus,
  Ban,
  CheckCircle2,
  RefreshCw,
  Filter,
  FileText,
  Undo2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Bank {
  id: string;
  name: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

interface RevenueCategory {
  id: string;
  name: string;
}

interface ImportRecord {
  id: string;
  file_name: string;
}

export default function ReconcileTransactions() {
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const { 
    isLoading, 
    fetchPendingTransactions, 
    acceptMatch,
    acceptPayableMatch,
    acceptMultipleInvoicesWithAdjustment,
    createRecord, 
    ignoreTransaction,
    getSuggestion,
    reverseReconciliation
  } = useImportedTransactions();

  // Data
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string, ReconciliationSuggestion>>(new Map());
  
  // Filters
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pendente');
  const [filterImport, setFilterImport] = useState<string>('all');
  
  // Classification dialog
  const [classifyDialogOpen, setClassifyDialogOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<ImportedTransaction | null>(null);
  const [classifyCategoryId, setClassifyCategoryId] = useState<string>('');
  const [classifyRevenueCategoryId, setClassifyRevenueCategoryId] = useState<string>('');
  const [classifyDescription, setClassifyDescription] = useState('');
  const [classifySource, setClassifySource] = useState('');
  
  // Credit dialog - link to invoice (multi-select)
  const [creditDialogTab, setCreditDialogTab] = useState<'create' | 'link'>('create');
  const [selectedInvoices, setSelectedInvoices] = useState<SelectedInvoice[]>([]);
  const [multiInvoiceSummary, setMultiInvoiceSummary] = useState<{
    totalSelected: number;
    difference: number;
    hasAdjustment: boolean;
  }>({ totalSelected: 0, difference: 0, hasAdjustment: false });
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  
  // Debit dialog - link to payable
  const [debitDialogTab, setDebitDialogTab] = useState<'create' | 'link'>('create');
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null);
  const [isExactPayableMatch, setIsExactPayableMatch] = useState(false);
  
  // Reversal dialog
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [reversalTransaction, setReversalTransaction] = useState<ImportedTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Load initial data
  useEffect(() => {
    if (!tenantId) return;
    
    const loadData = async () => {
      const [{ data: banksData }, { data: categoriesData }, { data: importsData }, { data: revenueCategoriesData }] = await Promise.all([
        supabase.from('banks').select('id, name').eq('tenant_id', tenantId).order('name'),
        supabase.from('expense_categories').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('name'),
        supabase.from('bank_statement_imports').select('id, file_name').eq('tenant_id', tenantId).order('imported_at', { ascending: false }),
        supabase.from('revenue_categories').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('name'),
      ]);
      
      setBanks(banksData || []);
      setCategories(categoriesData || []);
      setRevenueCategories(revenueCategoriesData || []);
      setImports(importsData || []);
    };
    loadData();
  }, [tenantId]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    const filters: { bankId?: string; importId?: string; status?: string } = {};
    if (filterBank !== 'all') filters.bankId = filterBank;
    if (filterImport !== 'all') filters.importId = filterImport;
    if (filterStatus !== 'all') filters.status = filterStatus;

    const data = await fetchPendingTransactions(filters);
    setTransactions(data);

    // Load suggestions for pending transactions
    const newSuggestions = new Map<string, ReconciliationSuggestion>();
    for (const tx of data.filter(t => t.status === 'pendente')) {
      const suggestion = await getSuggestion(tx);
      if (suggestion) {
        newSuggestions.set(tx.id, suggestion);
      }
    }
    setSuggestions(newSuggestions);
  }, [fetchPendingTransactions, getSuggestion, filterBank, filterStatus, filterImport]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Handlers
  const handleAcceptMatch = async (transaction: ImportedTransaction) => {
    const suggestion = suggestions.get(transaction.id);
    if (!suggestion) return;

    const success = await acceptMatch(
      transaction.id,
      suggestion.matchType,
      suggestion.matchId,
      transaction.transaction_date,
      transaction.bank_id,
      transaction.amount
    );

    if (success) {
      // Audit log for reconciliation
      await logEvent({
        action: 'UPDATE',
        tableName: 'imported_transactions',
        recordId: transaction.id,
        recordLabel: `Conciliação ${suggestion.matchType === 'invoice' ? 'NF' : 'Despesa'} - ${transaction.description}`,
        newData: { 
          status: 'conciliado', 
          matchType: suggestion.matchType,
          matchId: suggestion.matchId,
          amount: transaction.amount,
        },
      });
      loadTransactions();
    }
  };

  const handleIgnore = async (transaction: ImportedTransaction) => {
    const success = await ignoreTransaction(transaction.id);
    if (success) {
      loadTransactions();
    }
  };

  const openClassifyDialog = (transaction: ImportedTransaction) => {
    setCurrentTransaction(transaction);
    setClassifyCategoryId('');
    setClassifyDescription(transaction.description);
    setClassifySource('');
    // Reset credit tab - multi-select
    setCreditDialogTab('create');
    setSelectedInvoices([]);
    setMultiInvoiceSummary({ totalSelected: 0, difference: 0, hasAdjustment: false });
    setAdjustmentReason('');
    setAdjustmentNotes('');
    const defaultRevenueCategory = revenueCategories.find(c => c.name === 'Recebimento de Unidade');
    setClassifyRevenueCategoryId(defaultRevenueCategory?.id || (revenueCategories[0]?.id || ''));
    // Reset debit tab
    setDebitDialogTab('create');
    setSelectedPayableId(null);
    setIsExactPayableMatch(false);
    setClassifyDialogOpen(true);
  };
  
  const handleLinkToMultipleInvoices = async () => {
    if (!currentTransaction || selectedInvoices.length === 0) return;

    // If there's a value difference, require adjustment reason
    if (multiInvoiceSummary.hasAdjustment && !adjustmentReason.trim()) {
      toast.error('Informe o motivo do ajuste');
      return;
    }

    try {
      const invoicesData = selectedInvoices.map(inv => ({
        invoiceId: inv.invoiceId,
        allocatedAmount: inv.allocatedAmount,
      }));

      const success = await acceptMultipleInvoicesWithAdjustment(
        currentTransaction.id,
        invoicesData,
        currentTransaction.amount,
        currentTransaction.transaction_date,
        currentTransaction.bank_id,
        multiInvoiceSummary.hasAdjustment ? adjustmentReason : undefined,
        multiInvoiceSummary.hasAdjustment ? adjustmentNotes : undefined
      );

      if (success) {
        setClassifyDialogOpen(false);
        setCurrentTransaction(null);
        loadTransactions();
      }
    } catch (error) {
      console.error('Error linking to invoices:', error);
      toast.error('Erro ao vincular às notas fiscais');
    }
  };

  const handleLinkToPayable = async () => {
    if (!currentTransaction || !selectedPayableId) return;

    try {
      const success = await acceptPayableMatch(
        currentTransaction.id,
        selectedPayableId,
        currentTransaction.amount,
        currentTransaction.transaction_date,
        currentTransaction.bank_id
      );

      if (success) {
        setClassifyDialogOpen(false);
        setCurrentTransaction(null);
        loadTransactions();
      }
    } catch (error) {
      console.error('Error linking to payable:', error);
      toast.error('Erro ao vincular ao lançamento');
    }
  };
  
  const handleCategoryCreated = (newCategory: { id: string; name: string }) => {
    setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
    setClassifyCategoryId(newCategory.id);
  };

  const handleCreateRecord = async () => {
    if (!currentTransaction) return;

    if (currentTransaction.transaction_type === 'debit' && !classifyCategoryId) {
      toast.error('Selecione uma categoria para despesas');
      return;
    }

    // Use revenue category for credits, expense category for debits
    const categoryToUse = currentTransaction.transaction_type === 'credit' 
      ? classifyRevenueCategoryId 
      : classifyCategoryId;

    const success = await createRecord(
      currentTransaction.id,
      currentTransaction.transaction_type as 'credit' | 'debit',
      currentTransaction.amount,
      currentTransaction.transaction_date,
      currentTransaction.bank_id,
      categoryToUse || undefined,
      classifyDescription || undefined,
      classifySource || undefined
    );

    if (success) {
      setClassifyDialogOpen(false);
      setCurrentTransaction(null);
      loadTransactions();
    }
  };
  
  // Reversal handlers
  const openReversalDialog = (transaction: ImportedTransaction) => {
    setReversalTransaction(transaction);
    setReversalReason('');
    setReversalDialogOpen(true);
  };

  const handleReversal = async () => {
    if (!reversalTransaction || !reversalReason.trim()) {
      toast.error('Informe o motivo do estorno');
      return;
    }
    
    const success = await reverseReconciliation(reversalTransaction, reversalReason);
    if (success) {
      // Audit log for reversal
      await logEvent({
        action: 'UPDATE',
        tableName: 'imported_transactions',
        recordId: reversalTransaction.id,
        recordLabel: `Estorno conciliação - ${reversalTransaction.description}`,
        oldData: { status: reversalTransaction.status },
        newData: { status: 'pendente', reversal_reason: reversalReason },
      });
      setReversalDialogOpen(false);
      setReversalTransaction(null);
      loadTransactions();
    }
  };

  // Helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="mr-1 h-3 w-3" />Pendente</Badge>;
      case 'conciliado':
        return <Badge className="bg-green-600"><Link2 className="mr-1 h-3 w-3" />Conciliado</Badge>;
      case 'criado':
        return <Badge className="bg-blue-600"><Plus className="mr-1 h-3 w-3" />Criado</Badge>;
      case 'ignorado':
        return <Badge variant="secondary"><Ban className="mr-1 h-3 w-3" />Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = transactions.filter(t => t.status === 'pendente').length;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conciliar Transações</h1>
            <p className="text-muted-foreground">
              Concilie transações importadas com lançamentos existentes
            </p>
          </div>
          <Button variant="outline" onClick={loadTransactions} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Summary Card */}
        {pendingCount > 0 && (
          <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800 dark:text-yellow-200">
                  {pendingCount} transações pendentes de conciliação
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-lg">Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={filterBank} onValueChange={setFilterBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os bancos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os bancos</SelectItem>
                    {banks.map(bank => (
                      <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="conciliado">Conciliados</SelectItem>
                    <SelectItem value="criado">Criados</SelectItem>
                    <SelectItem value="ignorado">Ignorados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Importação</Label>
                <Select value={filterImport} onValueChange={setFilterImport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as importações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as importações</SelectItem>
                    {imports.map(imp => (
                      <SelectItem key={imp.id} value={imp.id}>{imp.file_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
            <CardDescription>
              {transactions.length} transações encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação encontrada</p>
                <p className="text-sm">Importe um extrato bancário para começar</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {transactions.map(transaction => {
                    const suggestion = suggestions.get(transaction.id);
                    
                    return (
                      <Card key={transaction.id} className={transaction.status !== 'pendente' ? 'opacity-70' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            {/* Transaction info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {transaction.transaction_type === 'credit' ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium">
                                  {format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                                <span className={`font-semibold ${
                                  transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {transaction.transaction_type === 'credit' ? '+' : '-'}
                                  {formatCurrency(transaction.amount)}
                                </span>
                                {getStatusBadge(transaction.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {transaction.description}
                              </p>
                              {transaction.banks?.name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Banco: {transaction.banks.name}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {transaction.status === 'pendente' && suggestion && (
                                <>
                                  <div className="text-right mr-2 max-w-[200px]">
                                    <Badge variant={suggestion.confidence === 'high' ? 'default' : 'secondary'} className="mb-1">
                                      {suggestion.confidence === 'high' ? 'Alta' : suggestion.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
                                    </Badge>
                                    <p className="text-sm truncate">{suggestion.matchDescription}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(suggestion.matchAmount)}
                                    </p>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => handleAcceptMatch(transaction)}
                                    disabled={isLoading}
                                    title="Aceitar sugestão"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              
                              {transaction.status === 'pendente' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => openClassifyDialog(transaction)}
                                    disabled={isLoading}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Criar
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleIgnore(transaction)}
                                    disabled={isLoading}
                                    title="Ignorar"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              {transaction.status !== 'pendente' && transaction.status !== 'ignorado' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openReversalDialog(transaction)}
                                  disabled={isLoading}
                                  className="text-amber-600 hover:text-amber-700"
                                  title="Estornar"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              )}
                              
                              {transaction.status !== 'pendente' && (
                                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Classification Dialog */}
        <Dialog open={classifyDialogOpen} onOpenChange={setClassifyDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {currentTransaction?.transaction_type === 'credit' ? 'Classificar Receita' : 'Criar Despesa'}
              </DialogTitle>
              <DialogDescription>
                {currentTransaction && (
                  <span className={currentTransaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                    {currentTransaction.transaction_type === 'credit' ? 'Crédito' : 'Débito'}: {formatCurrency(currentTransaction.amount)}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {/* Tabs for credit transactions - can either create or link */}
            {currentTransaction?.transaction_type === 'credit' && (
              <div className="flex gap-2 border-b pb-2">
                <Button
                  type="button"
                  variant={creditDialogTab === 'create' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCreditDialogTab('create')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Receita
                </Button>
                <Button
                  type="button"
                  variant={creditDialogTab === 'link' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCreditDialogTab('link')}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Vincular a NF
                </Button>
              </div>
            )}

            {/* Tabs for debit transactions - can either create expense or link to payable */}
            {currentTransaction?.transaction_type === 'debit' && (
              <div className="flex gap-2 border-b pb-2">
                <Button
                  type="button"
                  variant={debitDialogTab === 'create' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDebitDialogTab('create')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Despesa
                </Button>
                <Button
                  type="button"
                  variant={debitDialogTab === 'link' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDebitDialogTab('link')}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Vincular a Lançamento
                </Button>
              </div>
            )}

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Link to Invoice Tab (for credits) - Multi-select */}
                {currentTransaction?.transaction_type === 'credit' && creditDialogTab === 'link' && (
                  <>
                    <MultiInvoiceSelector
                      transactionAmount={currentTransaction.amount}
                      onSelectionChange={(invoices, summary) => {
                        setSelectedInvoices(invoices);
                        setMultiInvoiceSummary(summary);
                      }}
                    />
                    
                    {/* Adjustment section when values differ */}
                    {selectedInvoices.length > 0 && multiInvoiceSummary.hasAdjustment && (
                      <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                        {Math.abs(multiInvoiceSummary.difference) > 500 ? (
                          // Adjustment too large - not allowed
                          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <div>
                              <p>Diferença de {formatCurrency(multiInvoiceSummary.difference)} excede o limite de R$ 500,00</p>
                              <p className="text-xs font-normal text-muted-foreground mt-1">
                                Selecione notas que totalizem exatamente o valor do crédito ou com diferença de até R$ 500,00
                              </p>
                            </div>
                          </div>
                        ) : (
                          // Adjustment within limit - allow with reason
                          <>
                            <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                              <AlertCircle className="h-4 w-4" />
                              Ajuste de Valor ({formatCurrency(multiInvoiceSummary.difference)})
                            </div>

                            <div className="space-y-2">
                              <Label>Motivo do Ajuste *</Label>
                              <Input
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                placeholder="Ex: Taxa bancária, glosa, desconto..."
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Observações</Label>
                              <Textarea
                                value={adjustmentNotes}
                                onChange={(e) => setAdjustmentNotes(e.target.value)}
                                placeholder="Observações adicionais (opcional)"
                                rows={2}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Link to Payable Tab (for debits) */}
                {currentTransaction?.transaction_type === 'debit' && debitDialogTab === 'link' && (
                  <PayableSelector
                    transactionAmount={currentTransaction.amount}
                    selectedId={selectedPayableId}
                    onSelect={(payable, isExact) => {
                      setSelectedPayableId(payable?.id || null);
                      setIsExactPayableMatch(isExact);
                    }}
                  />
                )}

                {/* Create New Record Tab */}
                {((currentTransaction?.transaction_type === 'debit' && debitDialogTab === 'create') || 
                  (currentTransaction?.transaction_type === 'credit' && creditDialogTab === 'create')) && (
                  <>
                    {currentTransaction?.transaction_type === 'debit' && (
                      <CategorySelectorWithCreate
                        categories={categories}
                        value={classifyCategoryId}
                        onChange={setClassifyCategoryId}
                        onCategoryCreated={handleCategoryCreated}
                      />
                    )}

                    {currentTransaction?.transaction_type === 'credit' && (
                      <div className="space-y-2">
                        <Label>Categoria de Receita</Label>
                        <Select value={classifyRevenueCategoryId} onValueChange={setClassifyRevenueCategoryId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {revenueCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={classifyDescription}
                        onChange={e => setClassifyDescription(e.target.value)}
                        placeholder="Descrição do lançamento"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{currentTransaction?.transaction_type === 'debit' ? 'Fornecedor' : 'Origem'}</Label>
                      <Input
                        value={classifySource}
                        onChange={e => setClassifySource(e.target.value)}
                        placeholder={currentTransaction?.transaction_type === 'debit' ? 'Nome do fornecedor' : 'Origem da receita'}
                      />
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button variant="outline" onClick={() => setClassifyDialogOpen(false)}>
                  Cancelar
                </Button>
                {/* Credit link button - Multi-select */}
                {currentTransaction?.transaction_type === 'credit' && creditDialogTab === 'link' ? (
                  <Button 
                    onClick={handleLinkToMultipleInvoices} 
                    disabled={
                      isLoading || 
                      selectedInvoices.length === 0 || 
                      (multiInvoiceSummary.hasAdjustment && Math.abs(multiInvoiceSummary.difference) > 200) ||
                      (multiInvoiceSummary.hasAdjustment && !adjustmentReason.trim())
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    {selectedInvoices.length === 0 
                      ? 'Vincular Notas' 
                      : selectedInvoices.length === 1 
                        ? (multiInvoiceSummary.hasAdjustment ? 'Vincular com Ajuste' : 'Vincular à Nota')
                        : `Vincular ${selectedInvoices.length} Notas${multiInvoiceSummary.hasAdjustment ? ' com Ajuste' : ''}`
                    }
                  </Button>
                ) : currentTransaction?.transaction_type === 'debit' && debitDialogTab === 'link' ? (
                  /* Debit link button */
                  <Button 
                    onClick={handleLinkToPayable} 
                    disabled={isLoading || !selectedPayableId || !isExactPayableMatch}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Vincular e Pagar
                  </Button>
                ) : (
                  /* Create record button */
                  <Button onClick={handleCreateRecord} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Criar Lançamento
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reversal Dialog */}
        <Dialog open={reversalDialogOpen} onOpenChange={setReversalDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Estornar Conciliação</DialogTitle>
              <DialogDescription>
                {reversalTransaction?.status === 'criado' ? (
                  <>O lançamento criado será excluído e a transação voltará para "Pendente".</>
                ) : (
                  <>O vínculo com o lançamento será desfeito e a transação voltará para "Pendente".</>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <strong>Transação:</strong> {reversalTransaction?.description}
                <br />
                <strong>Valor:</strong> {formatCurrency(reversalTransaction?.amount || 0)}
              </div>
              
              <div>
                <Label>Motivo do Estorno *</Label>
                <Textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Informe o motivo do estorno..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReversalDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleReversal}
                disabled={isLoading || !reversalReason.trim()}
                variant="destructive"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Estorno
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
