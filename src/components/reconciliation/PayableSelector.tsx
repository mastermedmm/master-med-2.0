import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, X, User, FileText, Calendar } from 'lucide-react';
import { formatDateBR } from '@/lib/utils';

export interface PendingPayable {
  id: string;
  amount_to_pay: number;
  remaining_balance: number;
  expected_payment_date: string | null;
  doctor: { name: string };
  invoice: {
    invoice_number: string;
    company_name: string;
  };
}

interface PayableSelectorProps {
  transactionAmount: number;
  selectedId: string | null;
  onSelect: (payable: PendingPayable | null, isExactMatch: boolean) => void;
}

export function PayableSelector({ transactionAmount, selectedId, onSelect }: PayableSelectorProps) {
  const { tenantId } = useTenant();
  const [payables, setPayables] = useState<PendingPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const loadPayables = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      // Fetch pending/partially paid payables with doctor and invoice info - FILTERED BY TENANT
      const { data, error } = await supabase
        .from('accounts_payable')
        .select(`
          id,
          amount_to_pay,
          expected_payment_date,
          status,
          invoices!accounts_payable_invoice_id_fkey(invoice_number, company_name),
          doctors!accounts_payable_doctor_id_fkey(name)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['pendente', 'parcialmente_pago'])
        .order('expected_payment_date', { ascending: true });

      if (error) {
        console.error('Error loading payables:', error);
        return;
      }

      // For each payable, calculate remaining balance by subtracting non-reversed payments
      const payablesWithBalance: PendingPayable[] = [];

      for (const payable of data || []) {
        // Get sum of active payments (not reversed)
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('amount')
          .eq('account_payable_id', payable.id)
          .is('reversed_at', null);

        const totalPaid = (paymentsData || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const remainingBalance = Number(payable.amount_to_pay) - totalPaid;

        // Only include if there's something left to pay
        if (remainingBalance > 0.01) {
          payablesWithBalance.push({
            id: payable.id,
            amount_to_pay: Number(payable.amount_to_pay),
            remaining_balance: remainingBalance,
            expected_payment_date: payable.expected_payment_date,
            doctor: { name: (payable.doctors as any)?.name || 'Médico não informado' },
            invoice: {
              invoice_number: (payable.invoices as any)?.invoice_number || '-',
              company_name: (payable.invoices as any)?.company_name || '-',
            },
          });
        }
      }

      // Sort by proximity to transaction amount
      payablesWithBalance.sort((a, b) => {
        const diffA = Math.abs(a.remaining_balance - transactionAmount);
        const diffB = Math.abs(b.remaining_balance - transactionAmount);
        return diffA - diffB;
      });

      setPayables(payablesWithBalance);
    } catch (error) {
      console.error('Error loading payables:', error);
    } finally {
      setLoading(false);
    }
  }, [transactionAmount, tenantId]);

  useEffect(() => {
    loadPayables();
  }, [loadPayables]);

  // Filter by search term
  const filteredPayables = payables.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.doctor.name.toLowerCase().includes(term) ||
      p.invoice.invoice_number.toLowerCase().includes(term) ||
      p.invoice.company_name.toLowerCase().includes(term)
    );
  });

  const handleSelect = (payableId: string) => {
    const payable = payables.find(p => p.id === payableId);
    if (payable) {
      const isExact = Math.abs(payable.remaining_balance - transactionAmount) < 0.01;
      onSelect(payable, isExact);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando lançamentos...</span>
      </div>
    );
  }

  if (payables.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum lançamento pendente encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por médico, NF ou empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Valor do débito: <span className="font-semibold text-foreground">{formatCurrency(transactionAmount)}</span>
      </div>

      <ScrollArea className="h-[300px]">
        <RadioGroup
          value={selectedId || ''}
          onValueChange={handleSelect}
          className="space-y-2"
        >
          {filteredPayables.map((payable) => {
            const isExactMatch = Math.abs(payable.remaining_balance - transactionAmount) < 0.01;
            const isSelected = selectedId === payable.id;

            return (
              <div
                key={payable.id}
                className={`flex items-start space-x-3 border rounded-lg p-3 transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <RadioGroupItem value={payable.id} id={payable.id} className="mt-1" />
                <Label htmlFor={payable.id} className="flex-1 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{payable.doctor.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>NF {payable.invoice.invoice_number} - {payable.invoice.company_name}</span>
                      </div>
                      {payable.expected_payment_date && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Previsão: {formatDateBR(payable.expected_payment_date)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold">{formatCurrency(payable.remaining_balance)}</div>
                      {payable.remaining_balance !== payable.amount_to_pay && (
                        <div className="text-xs text-muted-foreground line-through">
                          {formatCurrency(payable.amount_to_pay)}
                        </div>
                      )}
                      {isExactMatch && (
                        <Badge variant="default" className="mt-1 bg-emerald-600 hover:bg-emerald-700">
                          Valor exato
                        </Badge>
                      )}
                    </div>
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </ScrollArea>

      {selectedId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect(null, false)}
          className="w-full"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
