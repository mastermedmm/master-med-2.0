import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDateBR } from '@/lib/utils';
import { DoctorCombobox } from '@/components/allocation/DoctorCombobox';

interface Invoice {
  id: string;
  company_name: string;
  hospital_name: string;
  issue_date: string;
  invoice_number: string;
  gross_value: number;
  total_deductions: number;
  iss_value: number;
  iss_percentage: number;
  irrf_value: number;
  inss_value: number;
  csll_value: number;
  pis_value: number;
  cofins_value: number;
  net_value: number;
  expected_receipt_date: string;
}

interface Doctor {
  id: string;
  name: string;
  cpf: string;
  crm: string;
  aliquota: number;
}

interface AllocationLine {
  id: string;
  doctorId: string;
  allocatedNetValue: string;
  adminFee: number;
  amountToPay: number;
}

export default function Allocation() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [allocations, setAllocations] = useState<AllocationLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoiceId && tenantId) {
      loadData();
    }
  }, [invoiceId, tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    
    try {
      const [invoiceRes, doctorsRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', invoiceId).eq('tenant_id', tenantId).single(),
        supabase.from('doctors').select('*').eq('tenant_id', tenantId).order('name'),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      
      setInvoice(invoiceRes.data);
      setDoctors(doctorsRes.data || []);

      // Load existing allocations if any
      const { data: existingAllocations } = await supabase
        .from('invoice_allocations')
        .select('*')
        .eq('invoice_id', invoiceId);

      if (existingAllocations && existingAllocations.length > 0) {
        setAllocations(existingAllocations.map(a => ({
          id: a.id,
          doctorId: a.doctor_id,
          allocatedNetValue: a.allocated_net_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          adminFee: Number(a.admin_fee),
          amountToPay: Number(a.amount_to_pay),
        })));
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar',
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

  const formatCurrencyCompact = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const formatCurrencyInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const number = parseInt(numericValue, 10) / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const addAllocation = () => {
    // Don't add if there's already an empty/incomplete line
    const hasEmptyLine = allocations.some(a => !a.doctorId || parseCurrency(a.allocatedNetValue) === 0);
    if (hasEmptyLine) return;

    setAllocations(prev => [...prev, {
      id: crypto.randomUUID(),
      doctorId: '',
      allocatedNetValue: '0,00',
      adminFee: 0,
      amountToPay: 0,
    }]);
  };

  const removeAllocation = (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
  };

  const updateAllocation = (id: string, field: keyof AllocationLine, value: string) => {
    setAllocations(prev => prev.map(a => {
      if (a.id !== id) return a;
      
      if (field === 'doctorId') {
        // When doctor changes, recalculate with their aliquota
        const doctor = doctors.find(d => d.id === value);
        const aliquota = doctor?.aliquota || 0;
        const allocatedGross = parseCurrency(a.allocatedNetValue);
        const adminFee = allocatedGross * (aliquota / 100);
        const amountToPay = allocatedGross - adminFee;
        
        return {
          ...a,
          doctorId: value,
          adminFee,
          amountToPay,
        };
      }
      
      if (field === 'allocatedNetValue') {
        const formatted = formatCurrencyInput(value);
        const allocatedGross = parseCurrency(formatted);
        
        // Get doctor's aliquota for admin fee calculation
        const doctor = doctors.find(d => d.id === a.doctorId);
        const aliquota = doctor?.aliquota || 0;
        
        // Admin fee based on doctor's aliquota
        const adminFee = allocatedGross * (aliquota / 100);
        const amountToPay = allocatedGross - adminFee;
        
        return {
          ...a,
          allocatedNetValue: formatted,
          adminFee,
          amountToPay,
        };
      }
      
      return { ...a, [field]: value };
    }));
  };

  const getTotalAllocated = () => {
    return allocations.reduce((sum, a) => sum + parseCurrency(a.allocatedNetValue), 0);
  };

  const getDifference = () => {
    if (!invoice) return 0;
    return Number(invoice.gross_value) - getTotalAllocated();
  };

  const getActiveAllocations = () => {
    return allocations.filter(a => a.doctorId || parseCurrency(a.allocatedNetValue) > 0);
  };

  const isValid = () => {
    const active = getActiveAllocations();
    const diff = Math.abs(getDifference());
    const hasAllocations = active.length > 0;
    const allValid = active.every(a => a.doctorId && parseCurrency(a.allocatedNetValue) > 0);
    return diff <= 0.01 && hasAllocations && allValid;
  };

  const handleSave = async () => {
    if (!isValid() || !invoice) {
      toast({
        title: 'Validação falhou',
        description: 'Verifique se todos os campos estão preenchidos e o rateio está correto',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      // Delete existing allocations
      await supabase.from('invoice_allocations').delete().eq('invoice_id', invoice.id);
      await supabase.from('accounts_payable').delete().eq('invoice_id', invoice.id);

      // Filter out empty lines and create new allocations with values
      const activeAllocations = getActiveAllocations();
      const allocationData = activeAllocations.map(a => ({
        invoice_id: invoice.id,
        doctor_id: a.doctorId,
        allocated_net_value: parseCurrency(a.allocatedNetValue),
        proportional_iss: 0,
        proportional_deductions: 0,
        admin_fee: a.adminFee,
        amount_to_pay: a.amountToPay,
        tenant_id: tenantId,
      }));

      const { data: newAllocations, error: allocError } = await supabase
        .from('invoice_allocations')
        .insert(allocationData)
        .select();

      if (allocError) throw allocError;

      // Create accounts payable entries
      const payablesData = newAllocations.map(a => ({
        invoice_id: invoice.id,
        allocation_id: a.id,
        doctor_id: a.doctor_id,
        allocated_net_value: a.allocated_net_value,
        proportional_iss: 0,
        proportional_deductions: 0,
        admin_fee: a.admin_fee,
        amount_to_pay: a.amount_to_pay,
        expected_payment_date: invoice.expected_receipt_date,
        status: 'pendente' as const,
        tenant_id: tenantId,
      }));

      const { error: payablesError } = await supabase
        .from('accounts_payable')
        .insert(payablesData);

      if (payablesError) throw payablesError;

      // Audit log for allocation creation
      await logEvent({
        action: 'INSERT',
        tableName: 'invoice_allocations',
        recordId: invoice.id,
        recordLabel: `Rateio NF ${invoice.invoice_number} - ${allocations.length} médico(s)`,
        newData: { invoice_id: invoice.id, allocations: allocationData },
      });

      toast({
        title: 'Rateio salvo!',
        description: 'O rateio foi salvo e os lançamentos foram gerados',
      });

      navigate(ROUTES.allocation);
    } catch (error: any) {
      console.error('Error saving allocation:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Nota não encontrada</h2>
          <Button className="mt-4" onClick={() => navigate(ROUTES.allocation)}>
            Voltar para Rateio
          </Button>
        </div>
      </AppLayout>
    );
  }

  const difference = getDifference();

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Rateio do Bruto por Médico</h1>
        <p className="page-description">Distribua o valor bruto entre os médicos</p>
      </div>

      {/* Invoice Summary - Compact Table Layout */}
      <Card className="mb-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Dados da Nota Fiscal</CardTitle>
        </CardHeader>
        <CardContent className="py-0 pb-3">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-1.5 font-semibold">EMISSÃO</TableHead>
                  <TableHead className="py-1.5 font-semibold">EMITENTE</TableHead>
                  <TableHead className="py-1.5 font-semibold">NOTA</TableHead>
                  <TableHead className="py-1.5 font-semibold">HOSPITAL</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">%ISS</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">ISS</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">IRRF</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">CP</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">CSLL</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">PIS</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">COFINS</TableHead>
                  <TableHead className="py-1.5 text-right font-semibold">LIQ NF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="py-1.5 font-mono">
                    {formatDateBR(invoice.issue_date)}
                  </TableCell>
                  <TableCell className="py-1.5 max-w-[120px] truncate" title={invoice.company_name}>
                    {invoice.company_name}
                  </TableCell>
                  <TableCell className="py-1.5 font-mono">{invoice.invoice_number}</TableCell>
                  <TableCell className="py-1.5 max-w-[120px] truncate" title={invoice.hospital_name}>
                    {invoice.hospital_name}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.iss_percentage || 0))}%
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.iss_value || 0))}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.irrf_value || 0))}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.inss_value || 0))}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.csll_value || 0))}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.pis_value || 0))}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">
                    {formatCurrencyCompact(Number(invoice.cofins_value || 0))}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono font-semibold text-primary">
                    {formatCurrencyCompact(Number(invoice.net_value))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Valor Bruto a Ratear:</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(Number(invoice.gross_value))}</span>
          </div>
        </CardContent>
      </Card>

      {/* Allocation Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div>
            <CardTitle className="text-sm">Rateio</CardTitle>
            <CardDescription className="text-xs">Adicione os médicos e seus valores</CardDescription>
          </div>
          <Button size="sm" onClick={addAllocation} disabled={allocations.length > 0 && Math.abs(getDifference()) <= 0.01}>
            <Plus className="mr-1 h-3 w-3" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum médico cadastrado</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate(ROUTES.doctors)}>
                Cadastrar Médicos
              </Button>
            </div>
          ) : (
            <>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px] py-1.5">Médico</TableHead>
                    <TableHead className="text-right w-[140px] py-1.5">Bruto</TableHead>
                    <TableHead className="text-right w-[100px] py-1.5">Taxa Adm</TableHead>
                    <TableHead className="text-right w-[100px] py-1.5">A Pagar</TableHead>
                    <TableHead className="w-[36px] py-1.5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => {
                    const doctor = doctors.find(d => d.id === allocation.doctorId);
                    return (
                      <TableRow key={allocation.id}>
                        <TableCell className="py-1">
                          <DoctorCombobox
                            doctors={doctors}
                            value={allocation.doctorId}
                            onSelect={(doctorId) => updateAllocation(allocation.id, 'doctorId', doctorId)}
                            placeholder="Selecione"
                          />
                        </TableCell>
                        <TableCell className="py-1 w-[140px]">
                          <Input
                            value={allocation.allocatedNetValue}
                            onChange={(e) => updateAllocation(allocation.id, 'allocatedNetValue', e.target.value)}
                            className="input-currency h-8 w-[130px] text-right text-sm font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground py-1">
                          {formatCurrencyCompact(allocation.adminFee)} {doctor ? `(${doctor.aliquota}%)` : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-success py-1">
                          {formatCurrencyCompact(allocation.amountToPay)}
                        </TableCell>
                        <TableCell className="py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeAllocation(allocation.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {allocations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Clique em "Adicionar" para distribuir o valor entre os médicos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-xs text-muted-foreground">Total Rateado</span>
                    <p className="text-base font-bold">{formatCurrency(getTotalAllocated())}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Diferença</span>
                    <p className={`text-base font-bold ${Math.abs(difference) <= 0.01 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(difference)}
                    </p>
                  </div>
                </div>
                {Math.abs(difference) <= 0.01 && allocations.length > 0 && (
                  <div className="flex items-center gap-1 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Rateio válido</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/allocation')}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!isValid() || saving}>
          {saving ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Rateio'
          )}
        </Button>
      </div>
    </AppLayout>
  );
}
