import { useState, useEffect, useMemo, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SearchableSelectWithId } from '@/components/ui/searchable-select-with-id';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenant } from '@/contexts/TenantContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, Clock, CheckCircle, Ban, Loader2, XCircle, Settings2, 
  MoreHorizontal, GripVertical, Filter, CalendarIcon, X, Eye
} from 'lucide-react';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, nowBrasilia, formatDateBR, formatDateTimeBR, toBrasiliaISO } from '@/lib/utils';
import { PaymentHistoryPopover } from '@/components/payables/PaymentHistoryPopover';

// Column configuration
type ColumnKey = 
  | 'doctor' | 'company' | 'hospital' | 'invoiceNumber' | 'issueDate'
  | 'grossValue' | 'deductions' | 'issValue' | 'netValue'
  | 'allocatedValue' | 'proportionalIss' | 'proportionalDeductions'
  | 'aliquota' | 'adminFee' | 'paymentsHistory' | 'totalPaid' | 'amountToPay' 
  | 'expectedPaymentDate' | 'paidAt' | 'createdAt' | 'status';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  shortLabel: string;
  defaultVisible: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'doctor', label: 'Médico', shortLabel: 'Médico', defaultVisible: true },
  { key: 'company', label: 'Empresa', shortLabel: 'Empresa', defaultVisible: false },
  { key: 'hospital', label: 'Hospital', shortLabel: 'Hospital', defaultVisible: true },
  { key: 'invoiceNumber', label: 'Nota Nº', shortLabel: 'Nota', defaultVisible: true },
  { key: 'issueDate', label: 'Data Emissão', shortLabel: 'Emissão', defaultVisible: false },
  { key: 'grossValue', label: 'Valor Bruto', shortLabel: 'Bruto', defaultVisible: false },
  { key: 'deductions', label: 'Retenções', shortLabel: 'Ret.', defaultVisible: false },
  { key: 'issValue', label: 'ISS Destacado', shortLabel: 'ISS', defaultVisible: false },
  { key: 'netValue', label: 'Valor Líquido NF', shortLabel: 'Líq. NF', defaultVisible: false },
  { key: 'allocatedValue', label: 'Valor Rateado', shortLabel: 'Rateado', defaultVisible: true },
  { key: 'proportionalIss', label: 'ISS Proporcional', shortLabel: 'ISS Prop.', defaultVisible: false },
  { key: 'proportionalDeductions', label: 'Retenções Proporcionais', shortLabel: 'Ret. Prop.', defaultVisible: false },
  { key: 'aliquota', label: 'Alíquota (%)', shortLabel: 'Alíq.', defaultVisible: true },
  { key: 'adminFee', label: 'Taxa Adm', shortLabel: 'Taxa', defaultVisible: true },
  { key: 'paymentsHistory', label: 'Pagamentos', shortLabel: 'Pgtos', defaultVisible: true },
  { key: 'totalPaid', label: 'Pago', shortLabel: 'Pago', defaultVisible: true },
  { key: 'amountToPay', label: 'A Pagar', shortLabel: 'A Pagar', defaultVisible: true },
  { key: 'expectedPaymentDate', label: 'Data Prev. Pgto', shortLabel: 'Prev.', defaultVisible: false },
  { key: 'paidAt', label: 'Data Pagamento', shortLabel: 'Pago em', defaultVisible: false },
  { key: 'createdAt', label: 'Data Criação', shortLabel: 'Criado', defaultVisible: false },
  { key: 'status', label: 'Status', shortLabel: 'Status', defaultVisible: true },
];

const STORAGE_KEY = 'payables-visible-columns';
const ORDER_STORAGE_KEY = 'payables-column-order';

interface Payable {
  id: string;
  invoice_id: string;
  doctor_id: string;
  allocated_net_value: number;
  admin_fee: number;
  amount_to_pay: number;
  expected_payment_date: string | null;
  status: 'aguardando_recebimento' | 'pendente' | 'pago' | 'cancelado' | 'parcialmente_pago';
  paid_at: string | null;
  created_at: string;
  proportional_iss: number;
  proportional_deductions: number;
  invoices: {
    company_name: string;
    hospital_name: string;
    invoice_number: string;
    gross_value: number;
    total_deductions: number;
    net_value: number;
    iss_value: number;
    issue_date: string;
    hospital_id: string | null;
    hospitals: {
      document: string | null;
    } | null;
  };
  doctors: {
    name: string;
    cpf: string;
    crm: string;
    aliquota: number;
  };
}

interface Bank {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  account_payable_id: string;
  amount: number;
  reversed_at: string | null;
}

interface PayableWithBalance extends Payable {
  remainingBalance: number;
  totalPaid: number;
  paymentsCount: number;
}

interface Filters {
  doctor: string;
  company: string;
  hospital: string;
  cnpj: string;
  dateType: 'issue' | 'due';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  status: string;
}

type DialogAction = 'pay' | 'cancel' | null;

export default function Payables() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const { canCustomize, loading: permissionsLoading } = usePermissions();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayable, setSelectedPayable] = useState<PayableWithBalance | null>(null);
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment dialog states
  const [banks, setBanks] = useState<Bank[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [loadingPayments, setLoadingPayments] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState<Filters>({
    doctor: '',
    company: '',
    hospital: '',
    cnpj: '',
    dateType: 'issue',
    dateFrom: undefined,
    dateTo: undefined,
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Column visibility state - will be loaded from DB
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    const defaultVisible = new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
    return defaultVisible;
  });

  // Column order state
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    return COLUMNS.map(c => c.key);
  });

  // Track if preferences are loaded from DB
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Drag state
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);

  // Load column preferences from database
  const loadColumnPreferences = async () => {
    if (!tenantId) {
      loadFromLocalStorage();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('column_preferences')
        .select('visible_columns, column_order')
        .eq('module_name', 'payables')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error loading column preferences:', error);
        // Fall back to localStorage
        loadFromLocalStorage();
        return;
      }

       if (data) {
         const allKeys = COLUMNS.map(c => c.key);
         const savedOrder = (data.column_order ?? []) as ColumnKey[];
         const savedOrderSet = new Set(savedOrder);

         // Load visible columns
         if (data.visible_columns && data.visible_columns.length > 0) {
           const visibleSet = new Set(data.visible_columns as ColumnKey[]);

           // Add ONLY new default-visible columns (columns that didn't exist when prefs were saved).
           // If the admin intentionally hid a defaultVisible column, we must respect that.
           COLUMNS.forEach(col => {
             const isNewColumn = savedOrder.length > 0 && !savedOrderSet.has(col.key);
             if (isNewColumn && col.defaultVisible && !visibleSet.has(col.key)) {
               visibleSet.add(col.key);
             }
           });

           // Remove any columns that no longer exist
           visibleSet.forEach(key => {
             if (!allKeys.includes(key)) {
               visibleSet.delete(key);
             }
           });

           setVisibleColumns(visibleSet);
         }

         // Load column order
         if (savedOrder && savedOrder.length > 0) {
           const savedSet = new Set(savedOrder);
           const newOrder = [...savedOrder];
           // Add any new columns not in saved order
           allKeys.forEach(key => {
             if (!savedSet.has(key)) {
               newOrder.push(key);
             }
           });
           // Filter out columns that no longer exist
           setColumnOrder(newOrder.filter(key => allKeys.includes(key)));
         }
       } else {
         // No preferences saved for this tenant yet, use localStorage fallback
         loadFromLocalStorage();
       }
      setPreferencesLoaded(true);
    } catch (error) {
      console.error('Error loading preferences:', error);
      loadFromLocalStorage();
    }
  };

  const loadFromLocalStorage = () => {
    const allKeys = COLUMNS.map(c => c.key);
    const defaultVisible = new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
    
    // Load visible columns from localStorage as fallback
    const savedVisible = localStorage.getItem(STORAGE_KEY);
    if (savedVisible) {
      try {
        const savedSet = new Set(JSON.parse(savedVisible) as ColumnKey[]);
        COLUMNS.forEach(col => {
          if (col.defaultVisible && !savedSet.has(col.key)) {
            savedSet.add(col.key);
          }
        });
        savedSet.forEach(key => {
          if (!allKeys.includes(key as ColumnKey)) {
            savedSet.delete(key);
          }
        });
        setVisibleColumns(savedSet);
      } catch {
        setVisibleColumns(defaultVisible);
      }
    }

    // Load order from localStorage
    const savedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder) as ColumnKey[];
        const savedSet = new Set(parsed);
        const newOrder = [...parsed];
        allKeys.forEach(key => {
          if (!savedSet.has(key)) {
            newOrder.push(key);
          }
        });
        setColumnOrder(newOrder.filter(key => allKeys.includes(key)));
      } catch {
        setColumnOrder(allKeys);
      }
    }
    setPreferencesLoaded(true);
  };

  // Save column preferences to database (admin only)
  const saveColumnPreferences = async () => {
    if (!canCustomize('payables') || !tenantId) return;

    try {
      const { error } = await supabase
        .from('column_preferences')
        .upsert({
          tenant_id: tenantId,
          module_name: 'payables',
          visible_columns: [...visibleColumns],
          column_order: columnOrder,
        }, {
          onConflict: 'tenant_id,module_name',
        });

      if (error) throw error;

      toast({
        title: 'Configuração salva',
        description: 'As colunas foram salvas para todos os usuários.',
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadPayables();
      loadBanks();
      loadColumnPreferences();
    }
  }, [tenantId]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isColumnVisible = (key: ColumnKey) => visibleColumns.has(key);

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleDragOver = (e: DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent<HTMLTableCellElement>, targetKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;

    setColumnOrder(prev => {
      const newOrder = [...prev];
      const draggedIdx = newOrder.indexOf(draggedColumn);
      const targetIdx = newOrder.indexOf(targetKey);
      
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedColumn);
      
      return newOrder;
    });
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Dynamic font sizing based on visible columns
  const getFontConfig = () => {
    const count = visibleColumns.size;
    if (count <= 6) return { base: 'text-sm', sub: 'text-xs', padding: 'px-3', maxWidth: 'max-w-[150px]', label: 'Normal' };
    if (count <= 10) return { base: 'text-xs', sub: 'text-[10px]', padding: 'px-2', maxWidth: 'max-w-[120px]', label: 'Compacto' };
    if (count <= 14) return { base: 'text-[11px]', sub: 'text-[9px]', padding: 'px-1.5', maxWidth: 'max-w-[100px]', label: 'Muito Compacto' };
    return { base: 'text-[10px]', sub: 'text-[8px]', padding: 'px-1', maxWidth: 'max-w-[80px]', label: 'Ultra Compacto' };
  };

  const fontConfig = getFontConfig();

  const loadPayables = async () => {
    if (!tenantId) return;
    
    try {
      // Load payables and payments in parallel
      const [payablesResult, paymentsResult] = await Promise.all([
        supabase
          .from('accounts_payable')
        .select(`
            *,
            invoices (company_name, hospital_name, invoice_number, gross_value, total_deductions, net_value, iss_value, issue_date, hospital_id, hospitals (document, payer_cnpj_1, payer_cnpj_2)),
            doctors (name, cpf, crm, aliquota)
          `)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('id, account_payable_id, amount, reversed_at')
          .eq('tenant_id', tenantId)
          .is('reversed_at', null)
      ]);

      if (payablesResult.error) throw payablesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      setPayables(payablesResult.data || []);
      setAllPayments(paymentsResult.data || []);
    } catch (error: any) {
      console.error('Error loading payables:', error);
      toast({
        title: 'Erro ao carregar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  // Filter options extracted from data
  const filterOptions = useMemo(() => {
    const doctors = [...new Map(payables.map(p => [p.doctor_id, { id: p.doctor_id, name: p.doctors.name }])).values()];
    const companies = [...new Set(payables.map(p => p.invoices.company_name))].filter(Boolean);
    const hospitals = [...new Set(payables.map(p => p.invoices.hospital_name))].filter(Boolean);
    return { doctors, companies, hospitals };
  }, [payables]);

  // Compute payables with remaining balance
  const payablesWithBalance: PayableWithBalance[] = useMemo(() => {
    return payables.map(p => {
      const paymentsForPayable = allPayments.filter(payment => payment.account_payable_id === p.id);
      const totalPaid = paymentsForPayable.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const remainingBalance = Number(p.amount_to_pay) - totalPaid;
      const paymentsCount = paymentsForPayable.length;
      return { ...p, totalPaid, remainingBalance, paymentsCount };
    });
  }, [payables, allPayments]);

  // Filtered payables
  const filteredPayables = useMemo(() => {
    return payablesWithBalance.filter(p => {
      if (filters.doctor && p.doctor_id !== filters.doctor) return false;
      if (filters.company && p.invoices.company_name !== filters.company) return false;
      if (filters.hospital && p.invoices.hospital_name !== filters.hospital) return false;
      
      // CNPJ filter - search in hospital document and payer CNPJs
      if (filters.cnpj) {
        const searchCnpj = filters.cnpj.replace(/\D/g, '');
        const hospital = p.invoices.hospitals as { document?: string; payer_cnpj_1?: string; payer_cnpj_2?: string } | null;
        const hospitalCnpj = (hospital?.document || '').replace(/\D/g, '');
        const payerCnpj1 = (hospital?.payer_cnpj_1 || '').replace(/\D/g, '');
        const payerCnpj2 = (hospital?.payer_cnpj_2 || '').replace(/\D/g, '');
        
        const matchesAny = hospitalCnpj.includes(searchCnpj) || 
                          payerCnpj1.includes(searchCnpj) || 
                          payerCnpj2.includes(searchCnpj);
        if (!matchesAny) return false;
      }
      
      // Date filter based on type - use string comparison to avoid timezone issues
      const dateToCheck = filters.dateType === 'issue' 
        ? p.invoices.issue_date 
        : p.expected_payment_date;
      
      if (filters.dateFrom && dateToCheck) {
        // Format filter date as YYYY-MM-DD string for comparison
        const fromDateStr = format(filters.dateFrom, 'yyyy-MM-dd');
        // dateToCheck is already YYYY-MM-DD from database
        if (dateToCheck < fromDateStr) return false;
      }
      if (filters.dateTo && dateToCheck) {
        const toDateStr = format(filters.dateTo, 'yyyy-MM-dd');
        if (dateToCheck > toDateStr) return false;
      }
      
      // Status filter
      if (filters.status) {
        if (filters.status === 'pago' && p.status !== 'pago') return false;
        if (filters.status === 'pendente' && !['pendente', 'aguardando_recebimento', 'parcialmente_pago'].includes(p.status)) return false;
      }
      
      return true;
    });
  }, [payablesWithBalance, filters]);

  // Pagination for filtered payables
  const paginationResult = useTablePagination(filteredPayables);
  const paginatedPayables = paginationResult.paginatedData;

  // Calculate totals from filtered data
  const totals = useMemo(() => {
    const totalRateado = filteredPayables.reduce((sum, p) => sum + Number(p.allocated_net_value), 0);
    const totalPago = filteredPayables
      .filter(p => p.status === 'pago')
      .reduce((sum, p) => sum + Number(p.amount_to_pay), 0);
    const totalAberto = filteredPayables
      .filter(p => p.status === 'pendente')
      .reduce((sum, p) => sum + Number(p.amount_to_pay), 0);
    return { totalRateado, totalPago, totalAberto };
  }, [filteredPayables]);

  const hasActiveFilters = filters.doctor || filters.company || filters.hospital || 
    filters.cnpj || filters.dateFrom || filters.dateTo || filters.status;

  const clearFilters = () => {
    setFilters({
      doctor: '',
      company: '',
      hospital: '',
      cnpj: '',
      dateType: 'issue',
      dateFrom: undefined,
      dateTo: undefined,
      status: '',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Use imported formatDateBR and formatDateTimeBR from utils

  const openDialog = (payable: PayableWithBalance, action: DialogAction) => {
    setSelectedPayable(payable);
    setDialogAction(action);
  };

  const closeDialog = () => {
    setSelectedPayable(null);
    setDialogAction(null);
  };

  // Payment dialog functions
  const openPaymentDialog = async (payable: PayableWithBalance) => {
    if (banks.length === 0) {
      toast({
        title: 'Nenhum banco cadastrado',
        description: 'Cadastre um banco antes de registrar pagamentos.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedPayable(payable);
    setRemainingAmount(payable.remainingBalance);
    setPaymentAmount(payable.remainingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPaymentBank('');
    setPaymentDate(new Date());
    setPaymentNotes('');
    setPaymentDialogOpen(true);
  };

  const closePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setSelectedPayable(null);
    setPaymentAmount('');
    setPaymentBank('');
    setPaymentDate(new Date());
    setPaymentNotes('');
  };

  const handleSavePayment = async () => {
    if (!selectedPayable || !paymentBank) {
      toast({
        title: 'Erro',
        description: 'Selecione um banco para continuar.',
        variant: 'destructive',
      });
      return;
    }

    // Parse formatted value (Brazilian format: 1.234,56 -> 1234.56)
    const amount = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Erro',
        description: 'Digite um valor válido.',
        variant: 'destructive',
      });
      return;
    }

    if (amount > remainingAmount + 0.01) {
      toast({
        title: 'Erro',
        description: 'O valor não pode ser maior que o saldo restante.',
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
          account_payable_id: selectedPayable.id,
          bank_id: paymentBank,
          amount,
          payment_date: paymentDateTime,
          notes: paymentNotes || null,
          tenant_id: tenantId,
        });

      if (paymentError) throw paymentError;

      // Check if fully paid
      const newTotalPaid = (Number(selectedPayable.amount_to_pay) - remainingAmount) + amount;
      const isFullyPaid = Math.abs(newTotalPaid - Number(selectedPayable.amount_to_pay)) < 0.01;

      // Update payable status
      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          status: isFullyPaid ? 'pago' : 'parcialmente_pago',
          paid_at: isFullyPaid ? nowBrasilia() : null,
        })
        .eq('id', selectedPayable.id);

      if (updateError) throw updateError;

      // Audit log for payment
      await logEvent({
        action: 'INSERT',
        tableName: 'payments',
        recordId: selectedPayable.id,
        recordLabel: `Pgto ${selectedPayable.doctors.name} - ${formatCurrency(amount)}`,
        newData: { 
          doctor: selectedPayable.doctors.name, 
          amount, 
          bank_id: paymentBank,
          payment_date: paymentDateTime,
        },
      });

      toast({
        title: 'Pagamento registrado!',
        description: `Pagamento de ${formatCurrency(amount)} registrado com sucesso.`,
      });

      closePaymentDialog();
      loadPayables();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      toast({
        title: 'Erro ao registrar pagamento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePay = async () => {
    if (!selectedPayable) return;

    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('accounts_payable')
        .update({
          status: 'pago',
          paid_at: nowBrasilia(),
        })
        .eq('id', selectedPayable.id);

      if (error) throw error;

      toast({
        title: 'Pagamento registrado!',
        description: `Pagamento de ${formatCurrency(Number(selectedPayable.amount_to_pay))} para ${selectedPayable.doctors.name} registrado`,
      });

      closeDialog();
      loadPayables();
    } catch (error: any) {
      console.error('Error paying:', error);
      toast({
        title: 'Erro ao pagar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedPayable) return;

    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('accounts_payable')
        .update({
          status: 'cancelado',
        })
        .eq('id', selectedPayable.id);

      if (error) throw error;

      // Audit log for cancellation
      await logEvent({
        action: 'UPDATE',
        tableName: 'accounts_payable',
        recordId: selectedPayable.id,
        recordLabel: `Cancelamento ${selectedPayable.doctors.name}`,
        oldData: { status: selectedPayable.status },
        newData: { status: 'cancelado' },
      });

      toast({
        title: 'Lançamento cancelado!',
        description: `Lançamento para ${selectedPayable.doctors.name} foi cancelado`,
      });

      closeDialog();
      loadPayables();
    } catch (error: any) {
      console.error('Error cancelling:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: Payable['status']) => {
    switch (status) {
      case 'aguardando_recebimento':
        return (
          <span className="status-badge status-waiting">
            <Clock className="h-3 w-3" />
            Aguardando
          </span>
        );
      case 'pendente':
        return (
          <span className="status-badge status-pending">
            <Clock className="h-3 w-3" />
            Pendente
          </span>
        );
      case 'pago':
        return (
          <span className="status-badge status-success">
            <CheckCircle className="h-3 w-3" />
            Pago
          </span>
        );
      case 'cancelado':
        return (
          <span className="status-badge status-cancelled">
            <Ban className="h-3 w-3" />
            Cancelado
          </span>
        );
      case 'parcialmente_pago':
        return (
          <span className="status-badge status-partial">
            <Clock className="h-3 w-3" />
            Parcial
          </span>
        );
    }
  };

  const pendingPayables = filteredPayables.filter(p => p.status === 'pendente');
  const paidPayables = filteredPayables.filter(p => p.status === 'pago');

  const renderCellContent = (payable: PayableWithBalance, key: ColumnKey) => {
    switch (key) {
      case 'doctor':
        return (
          <div>
            <p className={`font-medium ${fontConfig.base} truncate ${fontConfig.maxWidth}`} title={payable.doctors.name}>{payable.doctors.name}</p>
            <p className={`${fontConfig.sub} text-muted-foreground`}>CRM {payable.doctors.crm}</p>
          </div>
        );
      case 'company':
        return <span className={`${fontConfig.base} truncate ${fontConfig.maxWidth} block`} title={payable.invoices.company_name}>{payable.invoices.company_name}</span>;
      case 'hospital':
        return <span className={`${fontConfig.base} truncate ${fontConfig.maxWidth} block`} title={payable.invoices.hospital_name}>{payable.invoices.hospital_name}</span>;
      case 'invoiceNumber':
        return <span className={fontConfig.base}>{payable.invoices.invoice_number}</span>;
      case 'issueDate':
        return <span className={fontConfig.base}>{formatDateBR(payable.invoices.issue_date)}</span>;
      case 'grossValue':
        return <span className={`font-mono ${fontConfig.base}`}>{formatCurrency(Number(payable.invoices.gross_value))}</span>;
      case 'deductions':
        return <span className={`font-mono ${fontConfig.base} text-muted-foreground`}>{formatCurrency(Number(payable.invoices.total_deductions))}</span>;
      case 'issValue':
        return <span className={`font-mono ${fontConfig.base} text-muted-foreground`}>{formatCurrency(Number(payable.invoices.iss_value || 0))}</span>;
      case 'netValue':
        return <span className={`font-mono ${fontConfig.base}`}>{formatCurrency(Number(payable.invoices.net_value))}</span>;
      case 'allocatedValue':
        return <span className={`font-mono ${fontConfig.base}`}>{formatCurrency(Number(payable.allocated_net_value))}</span>;
      case 'proportionalIss':
        return <span className={`font-mono ${fontConfig.base} text-muted-foreground`}>{formatCurrency(Number(payable.proportional_iss || 0))}</span>;
      case 'proportionalDeductions':
        return <span className={`font-mono ${fontConfig.base} text-muted-foreground`}>{formatCurrency(Number(payable.proportional_deductions || 0))}</span>;
      case 'aliquota':
        return <span className={`font-mono ${fontConfig.base}`}>{payable.doctors.aliquota}%</span>;
      case 'adminFee':
        return <span className={`font-mono ${fontConfig.base} text-muted-foreground`}>{formatCurrency(Number(payable.admin_fee))}</span>;
      case 'paymentsHistory':
        return (
          <PaymentHistoryPopover
            payableId={payable.id}
            doctorName={payable.doctors.name}
            amountToPay={Number(payable.amount_to_pay)}
            totalPaid={payable.totalPaid}
            paymentsCount={payable.paymentsCount}
            onReversalComplete={loadPayables}
          />
        );
      case 'totalPaid':
        return <span className={`font-mono ${fontConfig.base} ${payable.totalPaid > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{formatCurrency(payable.totalPaid)}</span>;
      case 'amountToPay':
        // Show remaining balance for partial payments, otherwise show full amount
        const displayAmount = payable.status === 'parcialmente_pago' 
          ? payable.remainingBalance 
          : Number(payable.amount_to_pay);
        return <span className={`font-mono ${fontConfig.base} font-semibold text-success`}>{formatCurrency(displayAmount)}</span>;
      case 'expectedPaymentDate':
        return <span className={fontConfig.base}>{formatDateBR(payable.expected_payment_date)}</span>;
      case 'paidAt':
        return <span className={fontConfig.base}>{formatDateTimeBR(payable.paid_at)}</span>;
      case 'createdAt':
        return <span className={fontConfig.base}>{formatDateBR(payable.created_at)}</span>;
      case 'status':
        return getStatusBadge(payable.status);
      default:
        return null;
    }
  };

  // Get ordered visible columns
  const orderedVisibleColumns = useMemo(() => {
    return columnOrder.filter(key => isColumnVisible(key)).map(key => COLUMNS.find(c => c.key === key)!);
  }, [columnOrder, visibleColumns]);

  const PayableTable = ({ items, showActions = false }: { items: PayableWithBalance[]; showActions?: boolean }) => (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            {orderedVisibleColumns.map(col => (
              <TableHead 
                key={col.key} 
                className={`${fontConfig.base} whitespace-nowrap ${fontConfig.padding} cursor-grab select-none`}
                draggable
                onDragStart={(e) => handleDragStart(e, col.key)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.key)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground opacity-50" />
                  {col.shortLabel}
                </div>
              </TableHead>
            ))}
            {showActions && <TableHead className={`${fontConfig.base} ${fontConfig.padding}`}>Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((payable) => (
            <TableRow key={payable.id}>
              {orderedVisibleColumns.map(col => (
                <TableCell key={col.key} className={`py-1.5 ${fontConfig.padding}`}>
                  {renderCellContent(payable, col.key)}
                </TableCell>
              ))}
              {showActions && (
                <TableCell className={`py-1.5 ${fontConfig.padding}`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => openPaymentDialog(payable)}
                        disabled={payable.status === 'pago' || payable.status === 'cancelado'}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pagar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/payables/${payable.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Histórico
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => openDialog(payable, 'cancel')}
                        className="text-destructive focus:text-destructive"
                        disabled={payable.status === 'pago' || payable.status === 'cancelado'}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="h-4 w-4 mr-2" />
          Colunas ({visibleColumns.size})
          <span className="ml-1.5 text-xs text-muted-foreground">• {fontConfig.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-96 overflow-y-auto" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Colunas visíveis</p>
            <Button 
              size="sm" 
              variant="default" 
              className="h-7 text-xs"
              onClick={saveColumnPreferences}
            >
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Arraste os cabeçalhos para reordenar</p>
          {COLUMNS.map(col => (
            <div key={col.key} className="flex items-center space-x-2">
              <Checkbox
                id={col.key}
                checked={isColumnVisible(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
              />
              <Label htmlFor={col.key} className="text-sm cursor-pointer">
                {col.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const DatePickerButton = ({ 
    date, 
    onSelect, 
    placeholder 
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

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Lançamentos</h1>
          <p className="page-description">Gerencie os lançamentos e pagamentos aos médicos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            size="sm" 
            className="h-8"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && <span className="ml-1.5 h-2 w-2 rounded-full bg-primary" />}
          </Button>
          {canCustomize('payables') && <ColumnSelector />}
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {/* Doctor Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Médico</Label>
                <SearchableSelectWithId
                  options={filterOptions.doctors}
                  value={filters.doctor}
                  onValueChange={(v) => setFilters(f => ({ ...f, doctor: v }))}
                  placeholder="Todos"
                  searchPlaceholder="Buscar médico..."
                  emptyMessage="Nenhum médico encontrado."
                  allLabel="Todos"
                />
              </div>

              {/* Company (Empresa) Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa</Label>
                <SearchableSelect
                  options={filterOptions.companies}
                  value={filters.company}
                  onValueChange={(v) => setFilters(f => ({ ...f, company: v }))}
                  placeholder="Todas"
                  searchPlaceholder="Buscar empresa..."
                  emptyMessage="Nenhuma empresa encontrada."
                  allLabel="Todas"
                />
              </div>

              {/* Hospital Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Hospital</Label>
                <SearchableSelect
                  options={filterOptions.hospitals}
                  value={filters.hospital}
                  onValueChange={(v) => setFilters(f => ({ ...f, hospital: v }))}
                  placeholder="Todos"
                  searchPlaceholder="Buscar hospital..."
                  emptyMessage="Nenhum hospital encontrado."
                  allLabel="Todos"
                />
              </div>

              {/* CNPJ Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  className="h-8"
                  placeholder="00.000.000/0000-00"
                  value={filters.cnpj}
                  onChange={(e) => {
                    // Apply CNPJ mask
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length > 14) value = value.slice(0, 14);
                    if (value.length > 12) {
                      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
                    } else if (value.length > 8) {
                      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
                    } else if (value.length > 5) {
                      value = value.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
                    } else if (value.length > 2) {
                      value = value.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
                    }
                    setFilters(f => ({ ...f, cnpj: value }));
                  }}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === '__all__' ? '' : v }))}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Type Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Data</Label>
                <Select value={filters.dateType} onValueChange={(v) => setFilters(f => ({ ...f, dateType: v as 'issue' | 'due' }))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issue">Emissão</SelectItem>
                    <SelectItem value="due">Vencimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Date Range Filters Row */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{filters.dateType === 'issue' ? 'Emissão' : 'Vencimento'}: De</Label>
                <DatePickerButton
                  date={filters.dateFrom}
                  onSelect={(d) => setFilters(f => ({ ...f, dateFrom: d }))}
                  placeholder="Data inicial"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{filters.dateType === 'issue' ? 'Emissão' : 'Vencimento'}: Até</Label>
                <DatePickerButton
                  date={filters.dateTo}
                  onSelect={(d) => setFilters(f => ({ ...f, dateTo: d }))}
                  placeholder="Data final"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totalizer Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rateado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totals.totalRateado)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredPayables.length} lançamento{filteredPayables.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totals.totalPago)}</div>
            <p className="text-xs text-muted-foreground">
              {paidPayables.length} pagamento{paidPayables.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(totals.totalAberto)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingPayables.length} pendente{pendingPayables.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPayables.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum lançamento encontrado
            </div>
          ) : (
            <>
              <PayableTable items={paginatedPayables} showActions />
              {paginationResult.totalItems > 0 && (
                <TablePagination
                  currentPage={paginationResult.currentPage}
                  totalPages={paginationResult.totalPages}
                  totalItems={paginationResult.totalItems}
                  startIndex={paginationResult.startIndex}
                  endIndex={paginationResult.endIndex}
                  onPageChange={paginationResult.goToPage}
                  onNextPage={paginationResult.nextPage}
                  onPrevPage={paginationResult.prevPage}
                  onFirstPage={paginationResult.firstPage}
                  onLastPage={paginationResult.lastPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={closePaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedPayable?.doctors.name} - Nota {selectedPayable?.invoices.invoice_number}
            </DialogDescription>
          </DialogHeader>

          {loadingPayments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedPayable && (
            <div className="space-y-4">
              {/* Balance Info */}
              <div className="rounded-lg bg-muted p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total a Pagar</p>
                    <p className="font-mono font-medium">{formatCurrency(Number(selectedPayable.amount_to_pay))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saldo Restante</p>
                    <p className="font-mono font-medium text-warning">{formatCurrency(remainingAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Bank Select */}
              <div className="space-y-2">
                <Label htmlFor="bank">Banco *</Label>
                <Select value={paymentBank} onValueChange={setPaymentBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
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

              {/* Amount Input */}
              <div className="space-y-2">
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

              {/* Notes */}
              <div className="space-y-2">
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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePaymentDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} disabled={isProcessing || loadingPayments}>
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

      {/* Payment Confirmation Dialog (legacy - keeping for compatibility) */}
      <Dialog open={dialogAction === 'pay'} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Confirme o pagamento ao médico
            </DialogDescription>
          </DialogHeader>

          {selectedPayable && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">Médico</p>
                <p className="font-medium">{selectedPayable.doctors.name}</p>
                <p className="text-sm text-muted-foreground">
                  CPF: {selectedPayable.doctors.cpf} | CRM: {selectedPayable.doctors.crm}
                </p>
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">Referente à nota</p>
                <p className="font-medium">
                  {selectedPayable.invoices.company_name} - Nº {selectedPayable.invoices.invoice_number}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Bruto NF</p>
                  <p className="font-mono">{formatCurrency(Number(selectedPayable.invoices.gross_value))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retenções</p>
                  <p className="font-mono text-muted-foreground">{formatCurrency(Number(selectedPayable.invoices.total_deductions))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ISS Destacado</p>
                  <p className="font-mono text-muted-foreground">{formatCurrency(Number(selectedPayable.invoices.iss_value || 0))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Líquido NF</p>
                  <p className="font-mono">{formatCurrency(Number(selectedPayable.invoices.net_value))}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Rateado</p>
                  <p className="font-mono">{formatCurrency(Number(selectedPayable.allocated_net_value))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa Adm ({selectedPayable.doctors.aliquota}%)</p>
                  <p className="font-mono text-muted-foreground">{formatCurrency(Number(selectedPayable.admin_fee))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">A Pagar</p>
                  <p className="text-xl font-bold text-success">{formatCurrency(Number(selectedPayable.amount_to_pay))}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Voltar
            </Button>
            <Button onClick={handlePay} disabled={isProcessing}>
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

      {/* Cancel Confirmation Dialog */}
      <Dialog open={dialogAction === 'cancel'} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Lançamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este lançamento?
            </DialogDescription>
          </DialogHeader>

          {selectedPayable && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">Médico</p>
                <p className="font-medium">{selectedPayable.doctors.name}</p>
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">Referente à nota</p>
                <p className="font-medium">
                  {selectedPayable.invoices.company_name} - Nº {selectedPayable.invoices.invoice_number}
                </p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  Esta ação não poderá ser desfeita. O lançamento será marcado como cancelado.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
