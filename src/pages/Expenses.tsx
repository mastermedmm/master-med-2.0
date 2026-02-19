import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useTableSort } from "@/hooks/useTableSort";
import { useTablePagination } from "@/hooks/useTablePagination";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Receipt,
  CalendarIcon,
  DollarSign,
  Clock,
  CheckCircle,
  Filter,
  X,
  Undo2,
} from "lucide-react";
import { cn, toBrasiliaISO } from "@/lib/utils";

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Bank {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  category_id: string;
  supplier: string | null;
  description: string;
  amount: number;
  expense_date: string;
  due_date: string | null;
  paid_at: string | null;
  bank_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  expense_categories?: { name: string };
  banks?: { name: string };
}

interface FormData {
  supplier: string;
  category_id: string;
  description: string;
  amount: string;
  expense_date: Date;
  due_date: Date | undefined;
  notes: string;
}

interface PaymentFormData {
  bank_id: string;
  paid_at: Date;
}

interface Filters {
  category: string;
  status: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    category: "",
    status: "",
    dateFrom: undefined,
    dateTo: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const form = useForm<FormData>({
    defaultValues: {
      supplier: "",
      category_id: "",
      description: "",
      amount: "",
      expense_date: new Date(),
      due_date: undefined,
      notes: "",
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    defaultValues: {
      bank_id: "",
      paid_at: new Date(),
    },
  });

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  async function loadData() {
    if (!tenantId) return;
    
    try {
      const [expensesRes, categoriesRes, banksRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*, expense_categories(name), banks(name)")
          .eq("tenant_id", tenantId)
          .order("expense_date", { ascending: false }),
        supabase
          .from("expense_categories")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name"),
        supabase.from("banks").select("id, name").eq("tenant_id", tenantId).order("name"),
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (banksRes.error) throw banksRes.error;

      setExpenses(expensesRes.data || []);
      setCategories(categoriesRes.data || []);
      setBanks(banksRes.data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredExpenses = expenses.filter((expense) => {
    if (filters.category && expense.category_id !== filters.category) return false;
    if (filters.status && expense.status !== filters.status) return false;
    if (filters.dateFrom) {
      const expenseDate = parseISO(expense.expense_date);
      if (expenseDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const expenseDate = parseISO(expense.expense_date);
      if (expenseDate > filters.dateTo) return false;
    }
    return true;
  });

  const { sortedData: sortedExpenses, requestSort, getSortDirection } = useTableSort(filteredExpenses);
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
  } = useTablePagination(sortedExpenses);

  const totals = sortedExpenses.reduce(
    (acc, expense) => {
      acc.total += expense.amount;
      if (expense.status === "pago") {
        acc.paid += expense.amount;
      } else {
        acc.pending += expense.amount;
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0 }
  );

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function handleNew() {
    setSelectedExpense(null);
    form.reset({
      supplier: "",
      category_id: "",
      description: "",
      amount: "",
      expense_date: new Date(),
      due_date: undefined,
      notes: "",
    });
    setDialogOpen(true);
  }

  function handleEdit(expense: Expense) {
    setSelectedExpense(expense);
    form.reset({
      supplier: expense.supplier || "",
      category_id: expense.category_id,
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: parseISO(expense.expense_date),
      due_date: expense.due_date ? parseISO(expense.due_date) : undefined,
      notes: expense.notes || "",
    });
    setDialogOpen(true);
  }

  function handleDeleteClick(expense: Expense) {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  }

  function handlePayClick(expense: Expense) {
    setSelectedExpense(expense);
    paymentForm.reset({
      bank_id: "",
      paid_at: new Date(),
    });
    setPayDialogOpen(true);
  }

  function handleReversalClick(expense: Expense) {
    setSelectedExpense(expense);
    setReversalReason("");
    setReversalDialogOpen(true);
  }

  async function handleReversal() {
    if (!selectedExpense) return;
    if (!reversalReason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo do estorno.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          status: "pendente",
          bank_id: null,
          paid_at: null,
          notes: `[ESTORNO] ${reversalReason}${selectedExpense.notes ? `\n\n${selectedExpense.notes}` : ""}`,
        })
        .eq("id", selectedExpense.id);

      if (error) throw error;
      toast({ title: "Pagamento estornado com sucesso!" });
      setReversalDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao estornar pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = {
        supplier: data.supplier || null,
        category_id: data.category_id,
        description: data.description,
        amount: parseFloat(data.amount),
        expense_date: format(data.expense_date, "yyyy-MM-dd"),
        due_date: data.due_date ? format(data.due_date, "yyyy-MM-dd") : null,
        notes: data.notes || null,
      };

      if (selectedExpense) {
        const { error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", selectedExpense.id);

        if (error) throw error;

        await logEvent({
          action: 'UPDATE',
          tableName: 'expenses',
          recordId: selectedExpense.id,
          recordLabel: data.description,
          oldData: selectedExpense,
          newData: { ...selectedExpense, ...payload },
        });

        toast({ title: "Despesa atualizada com sucesso!" });
      } else {
        const { data: newExpense, error } = await supabase.from("expenses").insert({
          ...payload,
          created_by: user?.id,
          tenant_id: tenantId,
        }).select('id').single();

        if (error) throw error;

        await logEvent({
          action: 'INSERT',
          tableName: 'expenses',
          recordId: newExpense.id,
          recordLabel: data.description,
          newData: { ...payload, id: newExpense.id },
        });

        toast({ title: "Despesa criada com sucesso!" });
      }

      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar despesa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onPaymentSubmit(data: PaymentFormData) {
    if (!selectedExpense) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          status: "pago",
          bank_id: data.bank_id,
          paid_at: toBrasiliaISO(data.paid_at),
        })
        .eq("id", selectedExpense.id);

      if (error) throw error;
      toast({ title: "Pagamento registrado com sucesso!" });
      setPayDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedExpense) return;

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", selectedExpense.id);

      if (error) throw error;

      await logEvent({
        action: 'DELETE',
        tableName: 'expenses',
        recordId: selectedExpense.id,
        recordLabel: selectedExpense.description,
        oldData: selectedExpense,
      });

      toast({ title: "Despesa excluída com sucesso!" });
      setDeleteDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir despesa",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  function clearFilters() {
    setFilters({
      category: "",
      status: "",
      dateFrom: undefined,
      dateTo: undefined,
    });
  }

  const hasActiveFilters =
    filters.category || filters.status || filters.dateFrom || filters.dateTo;

  function DatePickerButton({
    date,
    onSelect,
    placeholder,
  }: {
    date: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    placeholder: string;
  }) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
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
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Despesas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie as despesas da empresa
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(hasActiveFilters && "border-primary text-primary")}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {
                    [
                      filters.category,
                      filters.status,
                      filters.dateFrom,
                      filters.dateTo,
                    ].filter(Boolean).length
                  }
                </Badge>
              )}
            </Button>
            {canCreate("expenses") && (
              <Button onClick={handleNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Despesa
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <Select
                    value={filters.category}
                    onValueChange={(v) =>
                      setFilters({ ...filters, category: v })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={filters.status}
                    onValueChange={(v) => setFilters({ ...filters, status: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Data Início</label>
                  <div className="mt-1">
                    <DatePickerButton
                      date={filters.dateFrom}
                      onSelect={(d) => setFilters({ ...filters, dateFrom: d })}
                      placeholder="Selecione"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Data Fim</label>
                  <div className="mt-1">
                    <DatePickerButton
                      date={filters.dateTo}
                      onSelect={(d) => setFilters({ ...filters, dateTo: d })}
                      placeholder="Selecione"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <DollarSign className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(totals.pending)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pago</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totals.paid)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">
              {hasActiveFilters
                ? "Nenhuma despesa encontrada"
                : "Nenhuma despesa cadastrada"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Tente ajustar os filtros."
                : "Crie uma despesa para começar."}
            </p>
            {!hasActiveFilters && canCreate("expenses") && (
              <Button className="mt-4" onClick={handleNew}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Despesa
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortDirection={getSortDirection('expense_date')}
                    onSort={() => requestSort('expense_date')}
                  >
                    Data
                  </SortableTableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection('supplier')}
                    onSort={() => requestSort('supplier')}
                  >
                    Fornecedor
                  </SortableTableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection('category_id')}
                    onSort={() => requestSort('category_id')}
                  >
                    Categoria
                  </SortableTableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection('description')}
                    onSort={() => requestSort('description')}
                  >
                    Descrição
                  </SortableTableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection('due_date')}
                    onSort={() => requestSort('due_date')}
                  >
                    Vencimento
                  </SortableTableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection('amount')}
                    onSort={() => requestSort('amount')}
                    className="text-right"
                  >
                    Valor
                  </SortableTableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection('status')}
                    onSort={() => requestSort('status')}
                    className="text-center"
                  >
                    Status
                  </SortableTableHead>
                  <SortableTableHead sortable={false} className="text-right">Ações</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {format(parseISO(expense.expense_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {expense.supplier || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {expense.expense_categories?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {expense.description}
                    </TableCell>
                    <TableCell>
                      {expense.due_date
                        ? format(parseISO(expense.due_date), "dd/MM/yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={expense.status === "pago" ? "default" : "secondary"}
                        className={cn(
                          expense.status === "pago" &&
                            "bg-success/15 text-success"
                        )}
                      >
                        {expense.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {expense.status === "pendente" && canUpdate("expenses") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePayClick(expense)}
                            className="text-success hover:text-success/80"
                            title="Registrar Pagamento"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {expense.status === "pago" && canUpdate("expenses") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReversalClick(expense)}
                            className="text-warning hover:text-warning/80"
                            title="Estornar Pagamento"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canUpdate("expenses") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(expense)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete("expenses") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(expense)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
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
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
            <DialogDescription>
              {selectedExpense
                ? "Atualize os dados da despesa."
                : "Preencha os dados para criar uma nova despesa."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Empresa XYZ Ltda" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                rules={{ required: "Categoria é obrigatória" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                rules={{ required: "Descrição é obrigatória" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Conta de luz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                rules={{
                  required: "Valor é obrigatório",
                  validate: (v) =>
                    parseFloat(v) > 0 || "Valor deve ser maior que zero",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expense_date"
                  rules={{ required: "Data é obrigatória" }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data da Despesa</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(field.value, "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })
                                : "Selecione"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Vencimento (opcional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(field.value, "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })
                                : "Selecione"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedExpense ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Informe os dados do pagamento da despesa.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4 rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Despesa</p>
            <p className="font-medium">{selectedExpense?.description}</p>
            <p className="mt-2 text-lg font-bold">
              {selectedExpense && formatCurrency(selectedExpense.amount)}
            </p>
          </div>

          <Form {...paymentForm}>
            <form
              onSubmit={paymentForm.handleSubmit(onPaymentSubmit)}
              className="space-y-4"
            >
              <FormField
                control={paymentForm.control}
                name="bank_id"
                rules={{ required: "Banco é obrigatório" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o banco" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="paid_at"
                rules={{ required: "Data é obrigatória" }}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data do Pagamento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(field.value, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "Selecione"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Pagamento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a despesa "{selectedExpense?.description}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reversal Dialog */}
      <Dialog open={reversalDialogOpen} onOpenChange={setReversalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Estornar Pagamento</DialogTitle>
            <DialogDescription>
              O pagamento da despesa "{selectedExpense?.description}" será estornado e o status
              voltará para "Pendente".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo do Estorno *</label>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setReversalDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReversal}
              disabled={saving || !reversalReason.trim()}
              variant="destructive"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Estorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
