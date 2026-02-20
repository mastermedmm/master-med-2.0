import { useState } from 'react';
import { todayBrasilia } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, RotateCcw, Loader2, ChevronDown, X } from 'lucide-react';
import { nowBrasilia, formatDateTimeBR } from '@/lib/utils';

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  reversed_at: string | null;
  notes: string | null;
  bank_id: string;
  banks: {
    name: string;
  };
}

interface PaymentHistoryPopoverProps {
  payableId: string;
  doctorName: string;
  amountToPay: number;
  totalPaid: number;
  paymentsCount: number;
  onReversalComplete: () => void;
}

export function PaymentHistoryPopover({
  payableId,
  doctorName,
  amountToPay,
  totalPaid,
  paymentsCount,
  onReversalComplete,
}: PaymentHistoryPopoverProps) {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Reversal dialog state
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const loadPayments = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          reversed_at,
          notes,
          bank_id,
          banks (name)
        `)
        .eq('account_payable_id', payableId)
        .eq('tenant_id', tenantId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments((data || []) as unknown as Payment[]);
    } catch (error: any) {
      console.error('Error loading payments:', error);
      toast({
        title: 'Erro ao carregar pagamentos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadPayments();
    }
  };

  const openReversalDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setReversalReason('');
    setReversalDialogOpen(true);
  };

  const handleReversal = async () => {
    if (!selectedPayment || !tenantId) return;

    if (!reversalReason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo do estorno.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Update payment as reversed
      const { error: reversalError } = await supabase
        .from('payments')
        .update({
          reversed_at: nowBrasilia(),
          reversed_by: user?.id,
          reversal_reason: reversalReason,
        })
        .eq('id', selectedPayment.id);

      if (reversalError) throw reversalError;

      // 2. Create a revenue entry as reversal (money coming back to the bank)
      const { error: revenueError } = await supabase
        .from('revenues')
        .insert({
          tenant_id: tenantId,
          bank_id: selectedPayment.bank_id,
          amount: selectedPayment.amount,
          revenue_date: todayBrasilia(),
          description: `Estorno pagamento - ${doctorName}`,
          source: 'estorno_pagamento',
          notes: `Estorno de pagamento (${formatCurrency(selectedPayment.amount)}). Motivo: ${reversalReason}`,
        });

      if (revenueError) throw revenueError;

      // 3. Recalculate remaining paid amount (excluding reversed payments)
      const remainingPayments = payments.filter(
        p => p.id !== selectedPayment.id && !p.reversed_at
      );
      const newTotalPaid = remainingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      // 4. Update payable status
      const newStatus = newTotalPaid > 0 
        ? (newTotalPaid >= amountToPay ? 'pago' : 'parcialmente_pago')
        : 'pendente';

      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          status: newStatus,
          paid_at: newStatus === 'pago' ? nowBrasilia() : null,
        })
        .eq('id', payableId);

      if (updateError) throw updateError;

      toast({
        title: 'Pagamento estornado!',
        description: `${formatCurrency(selectedPayment.amount)} devolvido ao banco e receita de estorno criada.`,
      });

      setReversalDialogOpen(false);
      setOpen(false);
      onReversalComplete();
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

  const activePayments = payments.filter(p => !p.reversed_at);
  const reversedPayments = payments.filter(p => p.reversed_at);

  if (paymentsCount === 0) {
    return (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
            <CreditCard className="h-3 w-3" />
            {paymentsCount} pgto{paymentsCount > 1 ? 's' : ''}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Histórico de Pagamentos</h4>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(totalPaid)} pago
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activePayments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Ativos</p>
                    {activePayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs"
                      >
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          <p className="text-muted-foreground">
                            {payment.banks?.name} • {formatDateTimeBR(payment.payment_date)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-destructive hover:text-destructive"
                          onClick={() => openReversalDialog(payment)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Estornar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {reversedPayments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Estornados</p>
                    {reversedPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-2 rounded-md bg-destructive/5 text-xs opacity-60"
                      >
                        <div>
                          <p className="font-medium line-through">{formatCurrency(payment.amount)}</p>
                          <p className="text-muted-foreground">
                            {payment.banks?.name} • Estornado
                          </p>
                        </div>
                        <X className="h-3 w-3 text-destructive" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Reversal Dialog */}
      <Dialog open={reversalDialogOpen} onOpenChange={setReversalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar Pagamento</DialogTitle>
            <DialogDescription>
              Esta ação irá criar uma receita de estorno no banco ({selectedPayment?.banks?.name}) 
              no valor de {selectedPayment ? formatCurrency(selectedPayment.amount) : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
              <p className="text-sm text-warning">
                <strong>Atenção:</strong> O pagamento será marcado como estornado e uma receita 
                será criada para registrar a devolução do valor ao banco.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reversal-reason">Motivo do estorno *</Label>
              <Textarea
                id="reversal-reason"
                placeholder="Informe o motivo do estorno..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReversalDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReversal}
              disabled={isProcessing || !reversalReason.trim()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirmar Estorno
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
