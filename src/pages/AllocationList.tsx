import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatDateBR } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useTableSort } from '@/hooks/useTableSort';
import { useTablePagination } from '@/hooks/useTablePagination';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { FileSearch, PieChart, Loader2, FileUp, Eye, MoreHorizontal, RotateCcw, AlertTriangle, Trash2, Filter, X, CheckCircle, CalendarIcon, Ban } from 'lucide-react';
import { InvoiceViewer } from '@/components/invoice/InvoiceViewer';
interface Invoice {
  id: string;
  company_name: string;
  hospital_name: string;
  issue_date: string;
  invoice_number: string;
  invoice_type: string;
  gross_value: number;
  total_deductions: number;
  net_value: number;
  iss_value: number;
  iss_percentage: number;
  irrf_value: number;
  inss_value: number;
  csll_value: number;
  pis_value: number;
  cofins_value: number;
  is_iss_retained: boolean;
  expected_receipt_date: string;
  status: 'pendente' | 'recebido' | 'parcialmente_recebido' | 'cancelado';
  total_received?: number;
  receipt_date: string | null;
  created_at: string;
  pdf_url: string | null;
  issuer_cnpj: string | null;
  hospital_cnpj: string | null;
  issuers?: { cnpj: string } | null;
  hospitals?: { document: string } | null;
  _allocations_count?: number;
}

interface Filters {
  company: string;
  hospital: string;
  invoiceNumber: string;
  cnpj: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  statusFilter: 'all' | 'pending_receipt' | 'pending_allocation';
  allocationFilter: 'all' | 'allocated' | 'not_allocated';
}

interface PaymentInfo {
  hasPayments: boolean;
  totalPaid: number;
  paymentsCount: number;
}

export default function AllocationList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  
  // Filter state - restore from sessionStorage if available
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const saved = sessionStorage.getItem('allocationListFilters');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          dateFrom: parsed.dateFrom ? new Date(parsed.dateFrom) : undefined,
          dateTo: parsed.dateTo ? new Date(parsed.dateTo) : undefined,
        };
      }
    } catch {}
    return {
      company: '',
      hospital: '',
      invoiceNumber: '',
      cnpj: '',
      dateFrom: undefined,
      dateTo: undefined,
      statusFilter: 'all',
      allocationFilter: 'all',
    };
  });
  const [showFilters, setShowFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem('allocationListFilters');
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!(parsed.company || parsed.hospital || parsed.invoiceNumber || parsed.cnpj || parsed.dateFrom || parsed.dateTo || parsed.allocationFilter !== 'all');
      }
    } catch {}
    return false;
  });

  // Persist filters to sessionStorage whenever they change
  useEffect(() => {
    const toSave = {
      ...filters,
      dateFrom: filters.dateFrom?.toISOString() ?? null,
      dateTo: filters.dateTo?.toISOString() ?? null,
    };
    sessionStorage.setItem('allocationListFilters', JSON.stringify(toSave));
  }, [filters]);
  
  // Reversal dialog state
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [checkingPayments, setCheckingPayments] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{ hasAllocations: boolean; hasPayments: boolean } | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cancel invoice dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Filter logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (filters.company && inv.company_name !== filters.company) return false;
      if (filters.hospital && inv.hospital_name !== filters.hospital) return false;
      if (filters.invoiceNumber && !inv.invoice_number.toLowerCase().includes(filters.invoiceNumber.toLowerCase())) return false;
      if (filters.cnpj) {
        const searchCnpj = filters.cnpj.replace(/\D/g, '');
        const issuerMatch = (inv.issuer_cnpj || '').includes(searchCnpj);
        const hospitalMatch = (inv.hospital_cnpj || '').includes(searchCnpj);
        if (!issuerMatch && !hospitalMatch) return false;
      }
      
      // Date filter (issue date / emissão)
      if (filters.dateFrom && inv.issue_date) {
        // Parse issue_date directly to avoid timezone issues (format: YYYY-MM-DD)
        const [year, month, day] = inv.issue_date.split('-').map(Number);
        const invDate = new Date(year, month - 1, day);
        invDate.setHours(0, 0, 0, 0);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (invDate < fromDate) return false;
      }
      if (filters.dateTo && inv.issue_date) {
        const [year, month, day] = inv.issue_date.split('-').map(Number);
        const invDate = new Date(year, month - 1, day);
        invDate.setHours(0, 0, 0, 0);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (invDate > toDate) return false;
      }
      
      // Status filter for card clicks
      if (filters.statusFilter === 'pending_receipt') {
        // Show only invoices that are NOT fully received (pendente or parcialmente_recebido)
        if (inv.status === 'recebido') return false;
      }
      if (filters.statusFilter === 'pending_allocation') {
        // Show only invoices without allocations
        if ((inv._allocations_count ?? 0) > 0) return false;
      }

      // Allocation filter (NF Rateada)
      if (filters.allocationFilter === 'allocated') {
        if ((inv._allocations_count ?? 0) === 0) return false;
      }
      if (filters.allocationFilter === 'not_allocated') {
        if ((inv._allocations_count ?? 0) > 0) return false;
      }
      
      return true;
    });
  }, [invoices, filters]);

  // Restore sort config from sessionStorage
  const savedSortConfig = useMemo(() => {
    const saved = sessionStorage.getItem('allocationListSort');
    if (saved) {
      try { return JSON.parse(saved); } catch { return undefined; }
    }
    return undefined;
  }, []);

  // Sorting - custom compare for invoice_number (numeric sort)
  const { sortedData, sortConfig, requestSort, getSortDirection } = useTableSort(filteredInvoices, savedSortConfig, (a, b, key) => {
    if (key === 'invoice_number') {
      const numA = parseInt(String(a[key]).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b[key]).replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    }
    // Default comparison for other keys
    const aVal = a[key];
    const bVal = b[key];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const dateA = Date.parse(aVal);
      const dateB = Date.parse(bVal);
      if (!isNaN(dateA) && !isNaN(dateB) && aVal.includes('-')) return dateA - dateB;
    }
    return String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase(), 'pt-BR');
  });

  // Persist sort config to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('allocationListSort', JSON.stringify(sortConfig));
  }, [sortConfig]);

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

  const filterOptions = useMemo(() => ({
    companies: [...new Set(invoices.map(i => i.company_name))].filter(Boolean).sort(),
    hospitals: [...new Set(invoices.map(i => i.hospital_name))].filter(Boolean).sort(),
  }), [invoices]);

  // Stats for cards
  const hasActiveFilters = filters.company || filters.hospital || filters.invoiceNumber || filters.cnpj || filters.dateFrom || filters.dateTo || filters.statusFilter !== 'all' || filters.allocationFilter !== 'all';

  const stats = useMemo(() => {
    // Use filtered invoices when filters are active, otherwise use all invoices
    const source = hasActiveFilters ? filteredInvoices : invoices;
    const total = source.length;
    const allocated = source.filter(inv => (inv._allocations_count ?? 0) > 0).length;
    const pendingAllocation = total - allocated;
    const pendingReceipt = source.filter(inv => inv.status !== 'recebido').length;
    const totalGrossValue = source.reduce((sum, inv) => sum + Number(inv.gross_value), 0);
    return { total, allocated, pendingAllocation, pendingReceipt, totalGrossValue };
  }, [invoices, filteredInvoices, hasActiveFilters]);

  const clearFilters = () => {
    setFilters({ company: '', hospital: '', invoiceNumber: '', cnpj: '', dateFrom: undefined, dateTo: undefined, statusFilter: 'all', allocationFilter: 'all' });
  };
  
  const handleCardClick = (filterType: 'all' | 'pending_receipt' | 'pending_allocation') => {
    // Toggle filter: if already active, clear it; otherwise apply it
    if (filters.statusFilter === filterType) {
      setFilters(f => ({ ...f, statusFilter: 'all' }));
    } else {
      setFilters(f => ({ ...f, statusFilter: filterType }));
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadInvoices();
    }
  }, [tenantId]);

  const loadInvoices = async () => {
    if (!tenantId) return;
    
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          issuers ( cnpj ),
          hospitals ( document )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Get allocation counts for this tenant
      const { data: allocationsData } = await supabase
        .from('invoice_allocations')
        .select('invoice_id')
        .eq('tenant_id', tenantId);

      const allocationCounts = (allocationsData || []).reduce((acc, a) => {
        acc[a.invoice_id] = (acc[a.invoice_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const invoicesWithCounts = (invoicesData || []).map(inv => ({
        ...inv,
        issuer_cnpj: (inv.issuers as any)?.cnpj || null,
        hospital_cnpj: (inv.hospitals as any)?.document || null,
        _allocations_count: allocationCounts[inv.id] || 0,
      }));

      setInvoices(invoicesWithCounts);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
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

  // Use imported formatDateBR from utils

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoiceForView(invoice);
    setViewerOpen(true);
  };

  const checkPaymentsForInvoice = async (invoiceId: string): Promise<PaymentInfo> => {
    if (!tenantId) return { hasPayments: false, totalPaid: 0, paymentsCount: 0 };
    
    // Get accounts_payable for this invoice (filtered by tenant)
    const { data: payables } = await supabase
      .from('accounts_payable')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId);

    if (!payables || payables.length === 0) {
      return { hasPayments: false, totalPaid: 0, paymentsCount: 0 };
    }

    const payableIds = payables.map(p => p.id);

    // Get active payments (not reversed) for these payables (filtered by tenant)
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount')
      .in('account_payable_id', payableIds)
      .eq('tenant_id', tenantId)
      .is('reversed_at', null);

    if (!payments || payments.length === 0) {
      return { hasPayments: false, totalPaid: 0, paymentsCount: 0 };
    }

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    return { hasPayments: true, totalPaid, paymentsCount: payments.length };
  };

  const handleOpenReversalDialog = async (invoice: Invoice) => {
    if (!invoice._allocations_count || invoice._allocations_count === 0) {
      toast({
        title: 'Sem rateio',
        description: 'Esta nota não possui rateio para estornar.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedInvoice(invoice);
    setCheckingPayments(true);
    setReversalDialogOpen(true);

    try {
      const info = await checkPaymentsForInvoice(invoice.id);
      setPaymentInfo(info);
    } catch (error) {
      console.error('Error checking payments:', error);
      setPaymentInfo({ hasPayments: false, totalPaid: 0, paymentsCount: 0 });
    } finally {
      setCheckingPayments(false);
    }
  };

  const handleCloseReversalDialog = () => {
    setReversalDialogOpen(false);
    setSelectedInvoice(null);
    setPaymentInfo(null);
  };

  const handleConfirmReversal = async () => {
    if (!selectedInvoice) return;

    // Don't allow if there are active payments
    if (paymentInfo?.hasPayments) {
      toast({
        title: 'Estorno não permitido',
        description: 'Estorne os pagamentos primeiro antes de estornar o rateio.',
        variant: 'destructive',
      });
      return;
    }

    setIsReversing(true);

    try {
      // Delete accounts_payable first (they reference invoice_allocations) - filtered by tenant
      const { error: payablesError } = await supabase
        .from('accounts_payable')
        .delete()
        .eq('invoice_id', selectedInvoice.id)
        .eq('tenant_id', tenantId);

      if (payablesError) throw payablesError;

      // Delete invoice_allocations - filtered by tenant
      const { error: allocationsError } = await supabase
        .from('invoice_allocations')
        .delete()
        .eq('invoice_id', selectedInvoice.id)
        .eq('tenant_id', tenantId);

      if (allocationsError) throw allocationsError;

      // Log the reversal
      await logEvent({
        action: 'DELETE',
        tableName: 'invoice_allocations',
        recordId: selectedInvoice.id,
        recordLabel: `Estorno rateio NF ${selectedInvoice.invoice_number}`,
        oldData: selectedInvoice,
      });

      toast({
        title: 'Rateio estornado!',
        description: `O rateio da nota ${selectedInvoice.invoice_number} foi removido com sucesso.`,
      });

      handleCloseReversalDialog();
      loadInvoices();
    } catch (error: any) {
      console.error('Error reversing allocation:', error);
      toast({
        title: 'Erro ao estornar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsReversing(false);
    }
  };

  // Delete invoice handlers
  const handleOpenDeleteDialog = async (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setCheckingDelete(true);
    setDeleteDialogOpen(true);

    try {
      const hasAllocations = invoice._allocations_count && invoice._allocations_count > 0;
      let hasPayments = false;

      if (hasAllocations) {
        const info = await checkPaymentsForInvoice(invoice.id);
        hasPayments = info.hasPayments;
      }

      setDeleteInfo({ hasAllocations: !!hasAllocations, hasPayments });
    } catch (error) {
      console.error('Error checking delete info:', error);
      setDeleteInfo({ hasAllocations: false, hasPayments: false });
    } finally {
      setCheckingDelete(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
    setDeleteInfo(null);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;

    // Block if there are payments
    if (deleteInfo?.hasPayments) {
      toast({
        title: 'Exclusão não permitida',
        description: 'Estorne os pagamentos primeiro antes de excluir a nota.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Delete in cascade order: payments (if any) -> accounts_payable -> invoice_allocations -> invoice
      // All filtered by tenant for strict data isolation
      
      // Delete accounts_payable first
      const { error: payablesError } = await supabase
        .from('accounts_payable')
        .delete()
        .eq('invoice_id', invoiceToDelete.id)
        .eq('tenant_id', tenantId);

      if (payablesError) throw payablesError;

      // Delete invoice_allocations
      const { error: allocationsError } = await supabase
        .from('invoice_allocations')
        .delete()
        .eq('invoice_id', invoiceToDelete.id)
        .eq('tenant_id', tenantId);

      if (allocationsError) throw allocationsError;

      // Delete the invoice itself
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceToDelete.id)
        .eq('tenant_id', tenantId);

      if (invoiceError) throw invoiceError;

      // Log the deletion
      await logEvent({
        action: 'DELETE',
        tableName: 'invoices',
        recordId: invoiceToDelete.id,
        recordLabel: `NF ${invoiceToDelete.invoice_number} - ${invoiceToDelete.company_name}`,
        oldData: invoiceToDelete,
      });

      toast({
        title: 'Nota excluída!',
        description: `A nota ${invoiceToDelete.invoice_number} foi removida com sucesso.`,
      });

      handleCloseDeleteDialog();
      loadInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel invoice handlers
  const handleOpenCancelDialog = (invoice: Invoice) => {
    setInvoiceToCancel(invoice);
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
    setInvoiceToCancel(null);
  };

  const handleConfirmCancel = async () => {
    if (!invoiceToCancel || !tenantId) return;

    setIsCancelling(true);

    try {
      // If invoice has allocations, cancel the accounts_payable entries
      if (invoiceToCancel._allocations_count && invoiceToCancel._allocations_count > 0) {
        const { error: payablesError } = await supabase
          .from('accounts_payable')
          .update({ status: 'cancelado' as any })
          .eq('invoice_id', invoiceToCancel.id)
          .eq('tenant_id', tenantId);

        if (payablesError) throw payablesError;
      }

      // Update invoice status to cancelado
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'cancelado' as any })
        .eq('id', invoiceToCancel.id)
        .eq('tenant_id', tenantId);

      if (invoiceError) throw invoiceError;

      // Log the cancellation
      await logEvent({
        action: 'UPDATE',
        tableName: 'invoices',
        recordId: invoiceToCancel.id,
        recordLabel: `Cancelamento NF ${invoiceToCancel.invoice_number} - ${invoiceToCancel.company_name}`,
        oldData: { status: invoiceToCancel.status },
        newData: { status: 'cancelado', accounts_payable_cancelled: !!(invoiceToCancel._allocations_count && invoiceToCancel._allocations_count > 0) },
      });

      toast({
        title: 'NF cancelada!',
        description: `A nota ${invoiceToCancel.invoice_number} foi cancelada${invoiceToCancel._allocations_count && invoiceToCancel._allocations_count > 0 ? ' e os lançamentos foram cancelados' : ''}.`,
      });

      handleCloseCancelDialog();
      loadInvoices();
    } catch (error: any) {
      console.error('Error cancelling invoice:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Rateio</h1>
          <p className="page-description">Gerencie o rateio das notas entre os médicos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && <span className="ml-1.5 h-2 w-2 rounded-full bg-primary" />}
          </Button>
          <Button onClick={() => navigate(ROUTES.import)}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar Nova
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {hasActiveFilters ? 'Notas Filtradas' : 'Notas Importadas'}
                </p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-[10px] font-medium text-muted-foreground">
                  {formatCurrency(stats.totalGrossValue)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileSearch className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Notas Rateadas</p>
                <p className="text-2xl font-bold text-success">{stats.allocated}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "stat-card cursor-pointer transition-all hover:shadow-md",
            filters.statusFilter === 'pending_receipt' && "ring-2 ring-destructive"
          )}
          onClick={() => handleCardClick('pending_receipt')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Notas Pendentes</p>
                <p className="text-2xl font-bold text-destructive">{stats.pendingReceipt}</p>
                <p className="text-[10px] text-muted-foreground">Sem recebimento total</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
            {filters.statusFilter === 'pending_receipt' && (
              <Badge variant="outline" className="mt-2 text-[10px] border-destructive text-destructive">
                Filtro ativo
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "stat-card cursor-pointer transition-all hover:shadow-md",
            filters.statusFilter === 'pending_allocation' && "ring-2 ring-warning"
          )}
          onClick={() => handleCardClick('pending_allocation')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Falta Ratear</p>
                <p className="text-2xl font-bold text-warning">{stats.pendingAllocation}</p>
                <p className="text-[10px] text-muted-foreground">Sem rateio</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <PieChart className="h-5 w-5 text-warning" />
              </div>
            </div>
            {filters.statusFilter === 'pending_allocation' && (
              <Badge variant="outline" className="mt-2 text-[10px] border-warning text-warning">
                Filtro ativo
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-end gap-4 flex-wrap">
              {/* Empresa */}
              <div className="space-y-1.5 flex-1 min-w-[150px]">
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

              {/* Hospital */}
              <div className="space-y-1.5 flex-1 min-w-[150px]">
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

              {/* Nota (texto livre) */}
              <div className="space-y-1.5 flex-1 min-w-[120px]">
                <Label className="text-xs">Nº Nota</Label>
                <Input
                  placeholder="Buscar nota..."
                  value={filters.invoiceNumber}
                  onChange={(e) => setFilters(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="h-8"
                />
              </div>

              {/* CNPJ com máscara */}
              <div className="space-y-1.5 flex-1 min-w-[120px]">
                <Label className="text-xs">CNPJ</Label>
                <Input
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
                  className="h-8"
                />
              </div>

              {/* Emissão: De */}
              <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-xs">Emissão: De</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 w-full justify-start text-left font-normal",
                        !filters.dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(d) => setFilters(f => ({ ...f, dateFrom: d }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Emissão: Até */}
              <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-xs">Emissão: Até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 w-full justify-start text-left font-normal",
                        !filters.dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(d) => setFilters(f => ({ ...f, dateTo: d }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* NF Rateada */}
              <div className="space-y-1.5 min-w-[130px]">
                <Label className="text-xs">NF Rateada</Label>
                <Select
                  value={filters.allocationFilter}
                  onValueChange={(v) => setFilters(f => ({ ...f, allocationFilter: v as Filters['allocationFilter'] }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="allocated">Sim</SelectItem>
                    <SelectItem value="not_allocated">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear button */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileSearch className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Nenhuma nota importada</p>
              <Button className="mt-4" onClick={() => navigate(ROUTES.import)}>
                <FileUp className="mr-2 h-4 w-4" />
                Importar Primeira Nota
              </Button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileSearch className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Nenhuma nota encontrada com os filtros aplicados</p>
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          ) : (
            <>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="text-xs">
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('company_name')}
                    onSort={() => requestSort('company_name')}
                  >
                    Empresa
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('hospital_name')}
                    onSort={() => requestSort('hospital_name')}
                  >
                    Hospital
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('invoice_number')}
                    onSort={() => requestSort('invoice_number')}
                  >
                    Nota
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('is_iss_retained')}
                    onSort={() => requestSort('is_iss_retained')}
                  >
                    ISS
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('issue_date')}
                    onSort={() => requestSort('issue_date')}
                  >
                    Emissão
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2 text-right"
                    sortDirection={getSortDirection('gross_value')}
                    onSort={() => requestSort('gross_value')}
                  >
                    Bruto
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2 text-right"
                    sortDirection={getSortDirection('net_value')}
                    onSort={() => requestSort('net_value')}
                  >
                    Líquido
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('_allocations_count')}
                    onSort={() => requestSort('_allocations_count')}
                  >
                    Rat.
                  </SortableTableHead>
                  <SortableTableHead 
                    className="py-1.5 px-2"
                    sortDirection={getSortDirection('status')}
                    onSort={() => requestSort('status')}
                  >
                    Receb.
                  </SortableTableHead>
                  <SortableTableHead className="py-1.5 px-1 w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((invoice) => (
                  <TableRow key={invoice.id} className={cn("text-xs", invoice.status === 'cancelado' && "bg-destructive/10 hover:bg-destructive/15")}>
                    <TableCell className="py-1.5 px-2 max-w-[100px] truncate" title={invoice.company_name}>
                      {invoice.company_name}
                    </TableCell>
                    <TableCell className="py-1.5 px-2 max-w-[110px] truncate" title={invoice.hospital_name}>
                      {invoice.hospital_name}
                    </TableCell>
                    <TableCell className="py-1.5 px-2">{invoice.invoice_number}</TableCell>
                    <TableCell className="py-1.5 px-2">
                      {invoice.is_iss_retained !== false ? (
                        <span className="text-success font-medium">Sim</span>
                      ) : (
                        <span className="text-warning font-medium">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-2">{formatDateBR(invoice.issue_date)}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono">{formatCurrency(Number(invoice.gross_value))}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono font-semibold">{formatCurrency(Number(invoice.net_value))}</TableCell>
                    <TableCell className="py-1.5 px-2">
                      {invoice._allocations_count && invoice._allocations_count > 0 ? (
                        <span className="text-success">{invoice._allocations_count}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-2">
                      {invoice.status === 'cancelado' ? (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                          Cancelada
                        </Badge>
                      ) : invoice.status === 'recebido' ? (
                        <div className="flex items-center gap-0.5">
                          <CheckCircle className="h-3 w-3 text-success" />
                          <span className="text-[10px] text-success font-medium">
                            {formatDateBR(invoice.receipt_date!)}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-warning/10 text-warning border-warning/30">
                          Pend.
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(ROUTES.allocationDetail(invoice.id))}>
                            <PieChart className="h-4 w-4 mr-2" />
                            {invoice._allocations_count && invoice._allocations_count > 0 ? 'Editar Rateio' : 'Ratear'}
                          </DropdownMenuItem>
                          {invoice._allocations_count && invoice._allocations_count > 0 && (
                            <DropdownMenuItem 
                              onClick={() => handleOpenReversalDialog(invoice)}
                              className="text-destructive focus:text-destructive"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Estornar Rateio
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleOpenDeleteDialog(invoice)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Nota
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleOpenCancelDialog(invoice)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancelar NF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Invoice Viewer */}
      <InvoiceViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        invoice={selectedInvoiceForView}
      />

      {/* Reversal Confirmation Dialog */}
      <Dialog open={reversalDialogOpen} onOpenChange={handleCloseReversalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar Rateio</DialogTitle>
            <DialogDescription>
              {selectedInvoice && (
                <>Nota {selectedInvoice.invoice_number} - {selectedInvoice.company_name}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {checkingPayments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Verificando pagamentos...</span>
            </div>
          ) : paymentInfo?.hasPayments ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Existem pagamentos vinculados</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta nota possui <strong>{paymentInfo.paymentsCount} pagamento(s)</strong> totalizando{' '}
                    <strong>{formatCurrency(paymentInfo.totalPaid)}</strong>.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Para estornar o rateio, você deve primeiro estornar todos os pagamentos 
                    na tela de <strong>Lançamentos</strong>.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseReversalDialog}>
                  Fechar
                </Button>
                <Button onClick={() => navigate('/payables')}>
                  Ir para Lançamentos
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <RotateCcw className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Confirmar estorno do rateio?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta ação irá remover todas as alocações e lançamentos gerados para esta nota.
                    A nota permanecerá importada e poderá ser rateada novamente.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseReversalDialog}>
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmReversal}
                  disabled={isReversing}
                >
                  {isReversing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Estornando...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Confirmar Estorno
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Nota Importada</DialogTitle>
            <DialogDescription>
              {invoiceToDelete && (
                <>Nota {invoiceToDelete.invoice_number} - {invoiceToDelete.company_name}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {checkingDelete ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Verificando dependências...</span>
            </div>
          ) : deleteInfo?.hasPayments ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Existem pagamentos vinculados</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta nota possui rateio com pagamentos efetuados.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Para excluir a nota, você deve primeiro estornar todos os pagamentos 
                    na tela de <strong>Lançamentos</strong>.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDeleteDialog}>
                  Fechar
                </Button>
                <Button onClick={() => navigate('/payables')}>
                  Ir para Lançamentos
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <Trash2 className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Confirmar exclusão permanente?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta ação irá excluir a nota importada
                    {deleteInfo?.hasAllocations && (
                      <>, incluindo <strong>todos os rateios e lançamentos</strong> gerados</>
                    )}.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 font-medium">
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDeleteDialog}>
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Confirmar Exclusão
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Invoice Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={handleCloseCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Nota Fiscal</DialogTitle>
            <DialogDescription>
              {invoiceToCancel && (
                <>Nota {invoiceToCancel.invoice_number} - {invoiceToCancel.company_name}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Ban className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Confirmar cancelamento da NF?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta ação irá cancelar a nota fiscal
                  {invoiceToCancel?._allocations_count && invoiceToCancel._allocations_count > 0 ? (
                    <> e <strong>todos os lançamentos (contas a pagar)</strong> vinculados ao rateio desta nota</>
                  ) : (
                    <> (sem rateio vinculado)</>
                  )}.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseCancelDialog}>
                Voltar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Confirmar Cancelamento
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
