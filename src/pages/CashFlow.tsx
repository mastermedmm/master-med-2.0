import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  CreditCard, 
  RotateCcw, 
  Wallet,
  CalendarIcon,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  Stethoscope
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bank {
  id: string;
  name: string;
  initial_balance: number;
}

interface CashFlowEntry {
  id: string;
  date: Date;
  type: 'revenue' | 'expense' | 'payment' | 'reversal';
  description: string;
  bankId: string;
  bankName: string;
  amount: number;
  direction: 'in' | 'out';
  category: string;
  categoryType: 'expense' | 'revenue' | 'fixed';
  reference?: string;
}

interface Filters {
  bank: string;
  category: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface Revenue {
  id: string;
  amount: number;
  revenue_date: string;
  description: string | null;
  source: string | null;
  bank_id: string | null;
  banks: { name: string } | null;
}

interface Expense {
  id: string;
  amount: number;
  paid_at: string | null;
  description: string;
  bank_id: string | null;
  banks: { name: string } | null;
  expense_categories: { name: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  reversed_at: string | null;
  bank_id: string;
  banks: { name: string } | null;
  accounts_payable: {
    doctors: { name: string };
    invoices: { invoice_number: string; company_name: string } | null;
  } | null;
}

interface InvoiceReceipt {
  id: string;
  amount: number;
  receipt_date: string;
  reversed_at: string | null;
  bank_id: string | null;
  banks: { name: string } | null;
  invoices: {
    invoice_number: string;
    company_name: string;
    hospital_name: string;
  } | null;
}

export default function CashFlow() {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [filters, setFilters] = useState<Filters>({
    bank: '',
    category: '',
    dateFrom: undefined,
    dateTo: undefined,
  });

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [banksResult, revenuesResult, expensesResult, paymentsResult, invoiceReceiptsResult] = await Promise.all([
        supabase.from('banks').select('id, name, initial_balance').eq('tenant_id', tenantId).order('name'),
        supabase.from('revenues').select('id, amount, revenue_date, description, source, bank_id, banks(name)').eq('tenant_id', tenantId),
        supabase.from('expenses').select('id, amount, paid_at, description, bank_id, banks(name), expense_categories(name)').eq('tenant_id', tenantId).eq('status', 'pago').not('paid_at', 'is', null),
        supabase.from('payments').select('id, amount, payment_date, reversed_at, bank_id, banks(name), accounts_payable(doctors(name), invoices(invoice_number, company_name))').eq('tenant_id', tenantId),
        supabase.from('invoice_receipts').select('id, amount, receipt_date, reversed_at, bank_id, banks(name), invoices(invoice_number, company_name, hospital_name)').eq('tenant_id', tenantId).is('reversed_at', null)
      ]);

      if (banksResult.error) throw banksResult.error;
      if (revenuesResult.error) throw revenuesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (invoiceReceiptsResult.error) throw invoiceReceiptsResult.error;

      setBanks(banksResult.data || []);

      const allEntries: CashFlowEntry[] = [];

      // Map revenues (entries - in) - exclude reversal revenues to avoid double counting
      ((revenuesResult.data || []) as unknown as Revenue[]).forEach(r => {
        // Skip reversal revenues as they're already counted via payment reversals
        if (r.source === 'estorno_pagamento') return;
        
        allEntries.push({
          id: `rev-${r.id}`,
          date: parseISO(r.revenue_date),
          type: 'revenue',
          description: r.description || 'Receita',
          bankId: r.bank_id || '',
          bankName: r.banks?.name || '-',
          amount: Number(r.amount),
          direction: 'in',
          category: r.source || 'Receita Geral',
          categoryType: 'revenue',
        });
      });

      // Map paid expenses (exits - out)
      (expensesResult.data as Expense[] || []).forEach(e => {
        if (e.paid_at) {
          allEntries.push({
            id: `exp-${e.id}`,
            date: parseISO(e.paid_at),
            type: 'expense',
            description: e.description,
            bankId: e.bank_id || '',
            bankName: e.banks?.name || '-',
            amount: Number(e.amount),
            direction: 'out',
            category: e.expense_categories?.name || 'Sem Categoria',
            categoryType: 'expense',
          });
        }
      });

      // Map payments (exits and reversals)
      ((paymentsResult.data || []) as unknown as Payment[]).forEach(p => {
        const doctorName = p.accounts_payable?.doctors?.name || 'Médico';
        const invoiceInfo = p.accounts_payable?.invoices 
          ? `NF ${p.accounts_payable.invoices.invoice_number}` 
          : '';

        if (p.reversed_at) {
          // Reversal - money back (in)
          allEntries.push({
            id: `rev-pay-${p.id}`,
            date: parseISO(p.reversed_at),
            type: 'reversal',
            description: `Estorno: ${doctorName}${invoiceInfo ? ` - ${invoiceInfo}` : ''}`,
            bankId: p.bank_id,
            bankName: p.banks?.name || '-',
            amount: Number(p.amount),
            direction: 'in',
            category: 'Estorno de Pagamento',
            categoryType: 'fixed',
          });
        } else {
          // Regular payment (out)
          allEntries.push({
            id: `pay-${p.id}`,
            date: parseISO(p.payment_date),
            type: 'payment',
            description: `${doctorName}${invoiceInfo ? ` - ${invoiceInfo}` : ''}`,
            bankId: p.bank_id,
            bankName: p.banks?.name || '-',
            amount: Number(p.amount),
            direction: 'out',
            category: 'Pagamento a Médico',
            categoryType: 'fixed',
          });
        }
      });

      // Map invoice receipts (entries - in)
      (invoiceReceiptsResult.data as InvoiceReceipt[] || []).forEach(ir => {
        if (ir.reversed_at) return; // Skip reversed receipts
        
        const invoiceNum = ir.invoices?.invoice_number || '-';
        const companyName = ir.invoices?.company_name || '';
        const hospitalName = ir.invoices?.hospital_name || '';
        
        allEntries.push({
          id: `invrec-${ir.id}`,
          date: parseISO(ir.receipt_date),
          type: 'revenue',
          description: `NF ${invoiceNum} - ${companyName}`,
          bankId: ir.bank_id || '',
          bankName: ir.banks?.name || '-',
          amount: Number(ir.amount),
          direction: 'in',
          category: 'Recebimento de NF',
          categoryType: 'revenue',
          reference: hospitalName,
        });
      });

      // Sort by date descending
      allEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEntries(allEntries);
    } catch (error: any) {
      console.error('Error loading cash flow:', error);
      toast({
        title: 'Erro ao carregar fluxo de caixa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Extract unique categories grouped by type
  const allCategories = useMemo(() => {
    const expenseCategories = [...new Set(entries.filter(e => e.categoryType === 'expense').map(e => e.category))].sort();
    const revenueCategories = [...new Set(entries.filter(e => e.categoryType === 'revenue').map(e => e.category))].sort();
    const fixedCategories = [...new Set(entries.filter(e => e.categoryType === 'fixed').map(e => e.category))].sort();
    
    return { expense: expenseCategories, revenue: revenueCategories, fixed: fixedCategories };
  }, [entries]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filters.bank && entry.bankId !== filters.bank) return false;
      if (filters.category && entry.category !== filters.category) return false;
      if (filters.dateFrom && entry.date < startOfDay(filters.dateFrom)) return false;
      if (filters.dateTo && entry.date > endOfDay(filters.dateTo)) return false;
      return true;
    });
  }, [entries, filters]);

  // Calculate opening balance and period totals
  const totals = useMemo(() => {
    const selectedBankIds = filters.bank ? [filters.bank] : banks.map(b => b.id);
    
    // Base initial balance from bank settings
    const baseInitialBalance = banks
      .filter(b => selectedBankIds.includes(b.id))
      .reduce((sum, b) => sum + Number(b.initial_balance), 0);
    
    // Calculate opening balance: base + all movements before dateFrom
    let openingIn = 0;
    let openingOut = 0;
    
    if (filters.dateFrom) {
      entries.forEach(e => {
        if (!selectedBankIds.includes(e.bankId)) return;
        if (e.date < startOfDay(filters.dateFrom!)) {
          if (e.direction === 'in') {
            openingIn += e.amount;
          } else {
            openingOut += e.amount;
          }
        }
      });
    }
    
    const openingBalance = baseInitialBalance + openingIn - openingOut;
    
    // Calculate period totals (filtered entries)
    const totalIn = filteredEntries
      .filter(e => e.direction === 'in')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalOut = filteredEntries
      .filter(e => e.direction === 'out')
      .reduce((sum, e) => sum + e.amount, 0);
    
    // Final balance = opening + period movements
    const finalBalance = openingBalance + totalIn - totalOut;

    return { initialBalance: openingBalance, totalIn, totalOut, finalBalance };
  }, [banks, entries, filteredEntries, filters.bank, filters.dateFrom]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: Date) => {
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  const getTypeIcon = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'revenue': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'expense': return <Receipt className="h-4 w-4 text-destructive" />;
      case 'payment': return <CreditCard className="h-4 w-4 text-destructive" />;
      case 'reversal': return <RotateCcw className="h-4 w-4 text-success" />;
    }
  };

  const getTypeBadge = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'revenue': return <Badge variant="outline" className="text-success border-success">Receita</Badge>;
      case 'expense': return <Badge variant="outline" className="text-destructive border-destructive">Despesa</Badge>;
      case 'payment': return <Badge variant="outline" className="text-amber-600 border-amber-500">Pagamento</Badge>;
      case 'reversal': return <Badge variant="outline" className="text-primary border-primary">Estorno</Badge>;
    }
  };

  const getCategoryIcon = (category: string, type: string) => {
    if (type === 'payment' || category === 'Pagamento a Médico') {
      return <Stethoscope className="h-3 w-3" />;
    }
    if (type === 'reversal' || category === 'Estorno de Pagamento') {
      return <RotateCcw className="h-3 w-3" />;
    }
    if (category.toLowerCase().includes('hospital')) {
      return <Building2 className="h-3 w-3" />;
    }
    return null;
  };

  const clearFilters = () => {
    setFilters({ bank: '', category: '', dateFrom: undefined, dateTo: undefined });
  };

  const hasFilters = filters.bank || filters.category || filters.dateFrom || filters.dateTo;

  const DatePickerButton = ({ date, onSelect, placeholder }: { 
    date: Date | undefined; 
    onSelect: (date: Date | undefined) => void; 
    placeholder: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} locale={ptBR} initialFocus />
      </PopoverContent>
    </Popover>
  );

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Fluxo de Caixa</h1>
        <p className="page-description">Visão consolidada de todas as movimentações financeiras</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Banco:</span>
              <Select value={filters.bank || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, bank: v === '__all__' ? '' : v }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {banks.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Categoria:</span>
              <Select value={filters.category || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, category: v === '__all__' ? '' : v }))}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  
                  {allCategories.expense.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2">
                          <ArrowDownCircle className="h-3 w-3 text-destructive" />
                          Saídas (Despesas)
                        </SelectLabel>
                        {allCategories.expense.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                  
                  {allCategories.fixed.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2">
                          <Stethoscope className="h-3 w-3 text-amber-600" />
                          Pagamentos/Estornos
                        </SelectLabel>
                        {allCategories.fixed.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                  
                  {allCategories.revenue.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2">
                          <ArrowUpCircle className="h-3 w-3 text-success" />
                          Entradas (Receitas)
                        </SelectLabel>
                        {allCategories.revenue.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <DatePickerButton date={filters.dateFrom} onSelect={(d) => setFilters(f => ({ ...f, dateFrom: d }))} placeholder="Data inicial" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Até:</span>
              <DatePickerButton date={filters.dateTo} onSelect={(d) => setFilters(f => ({ ...f, dateTo: d }))} placeholder="Data final" />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {filters.dateFrom ? 'Saldo de Abertura' : 'Saldo Inicial'}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold font-mono",
              totals.initialBalance >= 0 ? "text-foreground" : "text-destructive"
            )}>
              {formatCurrency(totals.initialBalance)}
            </div>
            {filters.dateFrom && (
              <p className="text-xs text-muted-foreground mt-1">
                Em {format(filters.dateFrom, "dd/MM/yyyy")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-success">+{formatCurrency(totals.totalIn)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">-{formatCurrency(totals.totalOut)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Final</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold font-mono", totals.finalBalance >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(totals.finalBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Movimentações</CardTitle>
          <CardDescription>
            {filteredEntries.length} movimentação(ões) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-8 text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma movimentação encontrada</h3>
              <p className="mt-2 text-muted-foreground">
                Ajuste os filtros ou importe um extrato bancário
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead className="w-[180px]">Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right w-[140px]">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(entry.type)}
                        {getTypeBadge(entry.type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        {getCategoryIcon(entry.category, entry.type)}
                        <span className="truncate">{entry.category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{entry.description}</TableCell>
                    <TableCell>{entry.bankName}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-semibold",
                      entry.direction === 'in' ? "text-success" : "text-destructive"
                    )}>
                      {entry.direction === 'in' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </TableCell>
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
