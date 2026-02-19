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
import { Banknote, RotateCcw, Loader2, ChevronDown, X } from 'lucide-react';
import { nowBrasilia, formatDateTimeBR } from '@/lib/utils';

interface Receipt {
  id: string;
  amount: number;
  receipt_date: string;
  reversed_at: string | null;
  notes: string | null;
  adjustment_amount: number;
  adjustment_reason: string | null;
  bank_id: string;
  banks: {
    name: string;
  };
}

interface ReceiptHistoryPopoverProps {
  invoiceId: string;
  invoiceNumber: string;
  netValue: number;
  totalReceived: number;
  receiptsCount: number;
  onReversalComplete: () => void;
}

export function ReceiptHistoryPopover({
  invoiceId,
  invoiceNumber,
  netValue,
  totalReceived,
  receiptsCount,
  onReversalComplete,
}: ReceiptHistoryPopoverProps) {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Reversal dialog state
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const loadReceipts = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoice_receipts')
        .select(`
          id,
          amount,
          receipt_date,
          reversed_at,
          notes,
          adjustment_amount,
          adjustment_reason,
          bank_id,
          banks (name)
        `)
        .eq('invoice_id', invoiceId)
        .eq('tenant_id', tenantId)
        .order('receipt_date', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error: any) {
      console.error('Error loading receipts:', error);
      toast({
        title: 'Erro ao carregar recebimentos',
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
      loadReceipts();
    }
  };

  const openReversalDialog = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setReversalReason('');
    setReversalDialogOpen(true);
  };

  const handleReversal = async () => {
    if (!selectedReceipt || !tenantId) return;

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
      // 1. Update receipt as reversed
      const { error: reversalError } = await supabase
        .from('invoice_receipts')
        .update({
          reversed_at: nowBrasilia(),
          reversed_by: user?.id,
          reversal_reason: reversalReason,
        })
        .eq('id', selectedReceipt.id);

      if (reversalError) throw reversalError;

      // 2. Recalculate remaining received amount (excluding reversed receipts)
      const remainingReceipts = receipts.filter(
        r => r.id !== selectedReceipt.id && !r.reversed_at
      );
      const newTotalReceived = remainingReceipts.reduce((sum, r) => sum + Number(r.amount), 0);
      
      // 3. Update invoice status
      let newStatus: 'pendente' | 'parcialmente_recebido' | 'recebido' = 'pendente';
      if (newTotalReceived > 0) {
        newStatus = Math.abs(newTotalReceived - netValue) < 0.01 || newTotalReceived >= netValue
          ? 'recebido' 
          : 'parcialmente_recebido';
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: newStatus,
          total_received: newTotalReceived,
          receipt_date: newStatus === 'recebido' ? todayBrasilia() : null,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      toast({
        title: 'Recebimento estornado!',
        description: `${formatCurrency(selectedReceipt.amount)} estornado da NF ${invoiceNumber}.`,
      });

      setReversalDialogOpen(false);
      setOpen(false);
      onReversalComplete();
    } catch (error: any) {
      console.error('Error reversing receipt:', error);
      toast({
        title: 'Erro ao estornar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const activeReceipts = receipts.filter(r => !r.reversed_at);
  const reversedReceipts = receipts.filter(r => r.reversed_at);
  const pendingBalance = netValue - totalReceived;

  if (receiptsCount === 0) {
    return (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
            <Banknote className="h-3 w-3" />
            {receiptsCount} receb.
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Histórico de Recebimentos</h4>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(totalReceived)} recebido
              </Badge>
            </div>

            {/* Summary */}
            <div className="text-xs space-y-1 p-2 rounded-md bg-muted/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor da Nota:</span>
                <span className="font-medium">{formatCurrency(netValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Recebido:</span>
                <span className="font-medium text-green-600">{formatCurrency(totalReceived)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Pendente:</span>
                <span className={`font-medium ${pendingBalance > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.max(0, pendingBalance))}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeReceipts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Ativos</p>
                    {activeReceipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs"
                      >
                        <div>
                          <p className="font-medium">{formatCurrency(receipt.amount)}</p>
                          <p className="text-muted-foreground">
                            {receipt.banks?.name} • {formatDateTimeBR(receipt.receipt_date)}
                          </p>
                          {receipt.adjustment_amount !== 0 && (
                            <p className="text-yellow-600 text-[10px]">
                              Ajuste: {formatCurrency(receipt.adjustment_amount)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-destructive hover:text-destructive"
                          onClick={() => openReversalDialog(receipt)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Estornar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {reversedReceipts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Estornados</p>
                    {reversedReceipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="flex items-center justify-between p-2 rounded-md bg-destructive/5 text-xs opacity-60"
                      >
                        <div>
                          <p className="font-medium line-through">{formatCurrency(receipt.amount)}</p>
                          <p className="text-muted-foreground">
                            {receipt.banks?.name} • Estornado
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
            <DialogTitle>Estornar Recebimento</DialogTitle>
            <DialogDescription>
              Esta ação irá estornar o recebimento de {selectedReceipt ? formatCurrency(selectedReceipt.amount) : ''} 
              da nota fiscal {invoiceNumber}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
              <p className="text-sm text-warning">
                <strong>Atenção:</strong> O recebimento será marcado como estornado e o status 
                da nota fiscal será recalculado automaticamente.
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
