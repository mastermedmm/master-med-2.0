import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTablePagination } from '@/hooks/useTablePagination';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, CalendarIcon, TrendingDown, TrendingUp, RotateCcw, Receipt, Wallet, CreditCard, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Bank {
  id: string;
  name: string;
  agency: string | null;
  account_number: string | null;
  initial_balance: number;
}

interface StatementEntry {
  id: string;
  date: Date;
  dateStr: string;
  type: 'payment' | 'reversal' | 'expense' | 'revenue' | 'invoice_receipt';
  description: string;
  amount: number;
  direction: 'in' | 'out';
  category: string;
  reference?: string;
}

export default function BankStatement() {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [bank, setBank] = useState<Bank | null>(null);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (bankId) {
      loadData();
    }
  }, [bankId]);

  const loadData = async () => {
    if (!bankId) return;
    
    try {
      // Load bank info and all movements in parallel - all filtered by bank_id which is already tenant-scoped
      const [bankResult, paymentsResult, expensesResult, revenuesResult, invoiceReceiptsResult] = await Promise.all([
        supabase.from('banks').select('*').eq('id', bankId).single(),
        supabase.from('payments').select(`
          id, amount, payment_date, reversed_at, reversal_reason, notes,
          accounts_payable (id, doctors (name), invoices (invoice_number, company_name))
        `).eq('bank_id', bankId),
        supabase.from('expenses').select(`
          id, amount, paid_at, description, expense_categories (name)
        `).eq('bank_id', bankId).eq('status', 'pago').not('paid_at', 'is', null),
        supabase.from('revenues').select('id, amount, revenue_date, description, source').eq('bank_id', bankId),
        supabase.from('invoice_receipts').select(`
          id, amount, receipt_date, reversed_at, notes, adjustment_amount,
          invoices (invoice_number, company_name, hospital_name)
        `).eq('bank_id', bankId).is('reversed_at', null)
      ]);

      if (bankResult.error) throw bankResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (revenuesResult.error) throw revenuesResult.error;
      if (invoiceReceiptsResult.error) throw invoiceReceiptsResult.error;

      setBank(bankResult.data);

      const allEntries: StatementEntry[] = [];

      // Payments to doctors (out) and reversals (in)
      (paymentsResult.data || []).forEach((p: any) => {
        const doctorName = p.accounts_payable?.doctors?.name || 'Médico';
        const invoiceNum = p.accounts_payable?.invoices?.invoice_number;
        const companyName = p.accounts_payable?.invoices?.company_name;

        if (p.reversed_at) {
          // Reversal - money back in
          allEntries.push({
            id: `rev-${p.id}`,
            date: parseISO(p.reversed_at),
            dateStr: p.reversed_at,
            type: 'reversal',
            description: `Estorno: ${doctorName}${invoiceNum ? ` - NF ${invoiceNum}` : ''}`,
            amount: Number(p.amount),
            direction: 'in',
            category: 'Estorno de Pagamento',
            reference: p.reversal_reason || undefined,
          });
        } else {
          // Regular payment out
          allEntries.push({
            id: `pay-${p.id}`,
            date: parseISO(p.payment_date),
            dateStr: p.payment_date,
            type: 'payment',
            description: `${doctorName}${invoiceNum ? ` - NF ${invoiceNum}` : ''}`,
            amount: Number(p.amount),
            direction: 'out',
            category: 'Pagamento a Médico',
            reference: companyName,
          });
        }
      });

      // Expenses (out)
      (expensesResult.data || []).forEach((e: any) => {
        allEntries.push({
          id: `exp-${e.id}`,
          date: parseISO(e.paid_at),
          dateStr: e.paid_at,
          type: 'expense',
          description: e.description,
          amount: Number(e.amount),
          direction: 'out',
          category: e.expense_categories?.name || 'Despesa',
        });
      });

      // Revenues (in) - exclude reversal revenues to avoid double counting
      (revenuesResult.data || []).forEach((r: any) => {
        if (r.source === 'estorno_pagamento') return; // Skip reversal revenues
        
        allEntries.push({
          id: `rev-${r.id}`,
          date: parseISO(r.revenue_date),
          dateStr: r.revenue_date,
          type: 'revenue',
          description: r.description || 'Receita',
          amount: Number(r.amount),
          direction: 'in',
          category: r.source || 'Receita',
        });
      });

      // Invoice receipts (in)
      (invoiceReceiptsResult.data || []).forEach((ir: any) => {
        const invoiceNum = ir.invoices?.invoice_number;
        const companyName = ir.invoices?.company_name;
        const hospitalName = ir.invoices?.hospital_name;
        
        allEntries.push({
          id: `invrec-${ir.id}`,
          date: parseISO(ir.receipt_date),
          dateStr: ir.receipt_date,
          type: 'invoice_receipt',
          description: `Recebimento NF ${invoiceNum || '-'} - ${companyName || ''}`,
          amount: Number(ir.amount),
          direction: 'in',
          category: 'Recebimento de NF',
          reference: hospitalName,
        });
      });

      // Sort by date descending
      allEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEntries(allEntries);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
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

  // Filter entries by date
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (e.date > endOfDay) return false;
      }
      return true;
    });
  }, [entries, dateFrom, dateTo]);

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
  } = useTablePagination(filteredEntries);

  // Calculate opening balance (all movements before dateFrom) and period totals
  const { openingBalance, totalIn, totalOut, closingBalance } = useMemo(() => {
    const bankInitial = bank?.initial_balance || 0;
    
    // Calculate opening balance: initial + all movements before dateFrom
    let openingIn = 0;
    let openingOut = 0;
    
    if (dateFrom) {
      entries.forEach(e => {
        if (e.date < dateFrom) {
          if (e.direction === 'in') {
            openingIn += e.amount;
          } else {
            openingOut += e.amount;
          }
        }
      });
    }
    
    const opening = bankInitial + openingIn - openingOut;
    
    // Calculate period totals (filtered entries)
    let periodIn = 0;
    let periodOut = 0;

    filteredEntries.forEach(e => {
      if (e.direction === 'in') {
        periodIn += e.amount;
      } else {
        periodOut += e.amount;
      }
    });

    // Closing balance = opening + period movements
    const closing = opening + periodIn - periodOut;

    return {
      openingBalance: opening,
      totalIn: periodIn,
      totalOut: periodOut,
      closingBalance: closing,
    };
  }, [entries, filteredEntries, bank, dateFrom]);

  const getTypeIcon = (type: StatementEntry['type']) => {
    switch (type) {
      case 'payment': return <CreditCard className="h-4 w-4 text-destructive" />;
      case 'reversal': return <RotateCcw className="h-4 w-4 text-success" />;
      case 'expense': return <Receipt className="h-4 w-4 text-destructive" />;
      case 'revenue': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'invoice_receipt': return <FileText className="h-4 w-4 text-success" />;
    }
  };

  const getTypeBadge = (type: StatementEntry['type']) => {
    switch (type) {
      case 'payment': return <Badge variant="outline" className="text-amber-600 border-amber-500">Pgto Médico</Badge>;
      case 'reversal': return <Badge variant="outline" className="text-primary border-primary">Estorno</Badge>;
      case 'expense': return <Badge variant="outline" className="text-destructive border-destructive">Despesa</Badge>;
      case 'revenue': return <Badge variant="outline" className="text-success border-success">Receita</Badge>;
      case 'invoice_receipt': return <Badge variant="outline" className="text-emerald-600 border-emerald-500">Receb. NF</Badge>;
    }
  };

  const DatePickerButton = ({
    date,
    onSelect,
    placeholder,
  }: {
    date: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    placeholder: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!bank) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Banco não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/banks')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/banks')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title">Extrato - {bank.name}</h1>
            <p className="page-description">
              {bank.agency && `Ag: ${bank.agency}`}
              {bank.agency && bank.account_number && ' | '}
              {bank.account_number && `Conta: ${bank.account_number}`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">De</Label>
              <DatePickerButton
                date={dateFrom}
                onSelect={setDateFrom}
                placeholder="Data inicial"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <DatePickerButton
                date={dateTo}
                onSelect={setDateTo}
                placeholder="Data final"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {dateFrom ? 'Saldo de Abertura' : 'Saldo Inicial'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              openingBalance >= 0 ? "text-foreground" : "text-destructive"
            )}>
              {formatCurrency(openingBalance)}
            </div>
            {dateFrom && (
              <p className="text-xs text-muted-foreground mt-1">
                Em {format(dateFrom, "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              +{formatCurrency(totalIn)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              -{formatCurrency(totalOut)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              closingBalance >= 0 ? "text-primary" : "text-destructive"
            )}>
              {formatCurrency(closingBalance)}
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
          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma movimentação encontrada
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right w-[140px]">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(entry.date, 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(entry.type)}
                          {getTypeBadge(entry.type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{entry.description}</div>
                        {entry.reference && (
                          <div className="text-xs text-muted-foreground">{entry.reference}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.category}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.direction === 'in' ? (
                          <span className="text-success">+{formatCurrency(entry.amount)}</span>
                        ) : (
                          <span className="text-destructive">-{formatCurrency(entry.amount)}</span>
                        )}
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
    </AppLayout>
  );
}
