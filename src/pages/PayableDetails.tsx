import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { 
  Loader2, ArrowLeft, CreditCard, Plus, RotateCcw, 
  CheckCircle, Clock, Ban, AlertCircle, CalendarIcon
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { nowBrasilia, formatDateTimeBR, cn, toBrasiliaISO } from '@/lib/utils';

interface Payable {
  id: string;
  allocated_net_value: number;
  admin_fee: number;
  amount_to_pay: number;
  status: string;
  paid_at: string | null;
  invoices: {
    company_name: string;
    hospital_name: string;
    invoice_number: string;
    gross_value: number;
  };
  doctors: {
    name: string;
    cpf: string;
    crm: string;
    aliquota: number;
  };
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  notes: string | null;
  bank_id: string;
  banks: {
    name: string;
  };
}

interface Bank {
  id: string;
  name: string;
}

export default function PayableDetails() {
  const { payableId } = useParams<{ payableId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  
  const [payable, setPayable] = useState<Payable | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Reversal dialog
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  useEffect(() => {
    if (payableId) {
      loadData();
    }
  }, [payableId]);

  const loadData = async () => {
    if (!payableId) return;
    
    try {
      // Load payable
      const { data: payableData, error: payableError } = await supabase
        .from('accounts_payable')
        .select(`
          *,
          invoices (company_name, hospital_name, invoice_number, gross_value),
          doctors (name, cpf, crm, aliquota)
        `)
        .eq('id', payableId)
        .single();

      if (payableError) throw payableError;
      setPayable(payableData);

      // Load payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          banks (name)
        `)
        .eq('account_payable_id', payableId)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments((paymentsData || []) as unknown as Payment[]);

      // Load banks
      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('id, name')
        .order('name');

      if (banksError) throw banksError;
      setBanks(banksData || []);
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

  // Use imported formatDateTimeBR from utils

  // Calculate paid amount (excluding reversed payments)
  const { totalPaid, remainingAmount } = useMemo(() => {
    const paid = payments
      .filter(p => !p.reversed_at)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = payable ? Number(payable.amount_to_pay) - paid : 0;
    return { totalPaid: paid, remainingAmount: remaining };
  }, [payments, payable]);

  const openPaymentDialog = () => {
    if (banks.length === 0) {
      toast({
        title: 'Nenhum banco cadastrado',
        description: 'Cadastre um banco antes de registrar pagamentos',
        variant: 'destructive',
      });
      return;
    }
    setPaymentAmount(remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPaymentBank('');
    setPaymentDate(new Date());
    setPaymentNotes('');
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!payable || !paymentBank) {
      toast({
        title: 'Erro',
        description: 'Selecione um banco',
        variant: 'destructive',
      });
      return;
    }

    // Parse formatted value (Brazilian format: 1.234,56 -> 1234.56)
    const amount = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Erro',
        description: 'Valor inválido',
        variant: 'destructive',
      });
      return;
    }

    if (amount > remainingAmount + 0.01) {
      toast({
        title: 'Erro',
        description: 'Valor maior que o saldo restante',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Use selected date or current time
      const paymentDateTime = paymentDate ? toBrasiliaISO(paymentDate) : nowBrasilia();
      
      // Insert payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          account_payable_id: payable.id,
          bank_id: paymentBank,
          amount,
          payment_date: paymentDateTime,
          notes: paymentNotes || null,
          tenant_id: tenantId,
        });

      if (paymentError) throw paymentError;

      // Update payable status
      const newTotalPaid = totalPaid + amount;
      const isFullyPaid = Math.abs(newTotalPaid - Number(payable.amount_to_pay)) < 0.01;
      
      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          status: isFullyPaid ? 'pago' : 'parcialmente_pago',
          paid_at: isFullyPaid ? nowBrasilia() : null,
        })
        .eq('id', payable.id);

      if (updateError) throw updateError;

      toast({
        title: 'Pagamento registrado!',
        description: `${formatCurrency(amount)} pago para ${payable.doctors.name}`,
      });

      setPaymentDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast({
        title: 'Erro ao registrar pagamento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openReversalDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setReversalReason('');
    setReversalDialogOpen(true);
  };

  const handleReversal = async () => {
    if (!selectedPayment || !payable) return;

    setIsProcessing(true);

    try {
      // Update payment as reversed
      const { error: reversalError } = await supabase
        .from('payments')
        .update({
          reversed_at: nowBrasilia(),
          reversed_by: user?.id,
          reversal_reason: reversalReason || null,
        })
        .eq('id', selectedPayment.id);

      if (reversalError) throw reversalError;

      // Recalculate status
      const newTotalPaid = totalPaid - Number(selectedPayment.amount);
      const newStatus: 'pendente' | 'parcialmente_pago' = newTotalPaid > 0 ? 'parcialmente_pago' : 'pendente';

      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          status: newStatus,
          paid_at: null,
        })
        .eq('id', payable.id);

      if (updateError) throw updateError;

      toast({
        title: 'Pagamento estornado!',
        description: `${formatCurrency(selectedPayment.amount)} estornado`,
      });

      setReversalDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error reversing payment:', error);
      toast({
        title: 'Erro ao estornar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aguardando_recebimento':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
      case 'pendente':
        return <Badge variant="outline" className="text-warning border-warning"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'parcialmente_pago':
        return <Badge variant="outline" className="text-primary border-primary"><AlertCircle className="h-3 w-3 mr-1" />Parcial</Badge>;
      case 'pago':
        return <Badge variant="outline" className="text-success border-success"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="text-destructive border-destructive"><Ban className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!payable) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Lançamento não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/payables')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const canPay = payable.status === 'pendente' || payable.status === 'parcialmente_pago';

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/payables')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title">Detalhes do Lançamento</h1>
            <p className="page-description">
              {payable.doctors.name} - Nota {payable.invoices.invoice_number}
            </p>
          </div>
        </div>
        {canPay && (
          <Button onClick={openPaymentDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pagamento
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Médico</p>
                <p className="font-medium">{payable.doctors.name}</p>
                <p className="text-xs text-muted-foreground">CRM {payable.doctors.crm}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(payable.status)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{payable.invoices.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hospital</p>
                <p className="font-medium">{payable.invoices.hospital_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Valores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor Rateado</p>
                <p className="font-mono text-lg">{formatCurrency(payable.allocated_net_value)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Adm ({payable.doctors.aliquota}%)</p>
                <p className="font-mono text-lg text-muted-foreground">{formatCurrency(payable.admin_fee)}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total a Pagar</p>
                  <p className="font-mono text-xl font-bold">{formatCurrency(payable.amount_to_pay)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pago</p>
                  <p className="font-mono text-xl font-bold text-success">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Restante</p>
                  <p className="font-mono text-xl font-bold text-warning">{formatCurrency(remainingAmount)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>
            {payments.length} pagamento(s) registrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum pagamento registrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className={payment.reversed_at ? 'opacity-60' : ''}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeBR(payment.payment_date)}
                    </TableCell>
                    <TableCell>{payment.banks?.name || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {payment.reversed_at ? (
                        <span className="line-through">{formatCurrency(payment.amount)}</span>
                      ) : (
                        <span className="text-success">{formatCurrency(payment.amount)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.reversed_at ? (
                        <Badge variant="outline" className="text-warning border-warning">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Estornado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-success border-success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Confirmado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {payment.reversed_at ? payment.reversal_reason : payment.notes || '-'}
                    </TableCell>
                    <TableCell>
                      {!payment.reversed_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReversalDialog(payment)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre um pagamento para {payable.doctors.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total a Pagar</p>
                  <p className="font-mono font-medium">{formatCurrency(payable.amount_to_pay)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo Restante</p>
                  <p className="font-mono font-medium text-warning">{formatCurrency(remainingAmount)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bank">Banco *</Label>
              <Select value={paymentBank} onValueChange={setPaymentBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Data do Pagamento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={setPaymentDate}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => {
                  // Allow only numbers, dots, and commas
                  let value = e.target.value.replace(/[^\d.,]/g, '');
                  // Replace comma with dot for internal storage
                  value = value.replace(',', '.');
                  setPaymentAmount(value);
                }}
                onBlur={() => {
                  // Format on blur
                  const numValue = parseFloat(paymentAmount);
                  if (!isNaN(numValue)) {
                    setPaymentAmount(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  }
                }}
                onFocus={() => {
                  // Remove formatting on focus
                  const numValue = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
                  if (!isNaN(numValue)) {
                    setPaymentAmount(numValue.toString());
                  }
                }}
                className="font-mono"
                placeholder="0,00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Observações opcionais..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reversal Dialog */}
      <Dialog open={reversalDialogOpen} onOpenChange={setReversalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar Pagamento</DialogTitle>
            <DialogDescription>
              Esta ação irá estornar o pagamento e devolver o valor ao saldo em aberto
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="grid gap-4 py-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-mono font-medium">{formatCurrency(selectedPayment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-medium">{formatDateTimeBR(selectedPayment.payment_date)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reason">Motivo do Estorno</Label>
                <Textarea
                  id="reason"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Descreva o motivo do estorno..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReversalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReversal} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Confirmar Estorno
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
