import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { FileText, Search, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export interface InvoiceAllocation {
  id: string;
  invoice_id: string;
  allocated_net_value: number;
  amount_to_pay: number;
  totalReceived: number;
  pendingBalance: number;
  invoice: {
    invoice_number: string;
    company_name: string;
    hospital_name: string;
    hospital_cnpj: string | null;
    payer_cnpj_1: string | null;
    payer_cnpj_2: string | null;
    issue_date: string;
    net_value: number;
    total_received: number;
    expected_receipt_date: string;
    status: string;
    issuer_name: string | null;
  };
}

export interface SelectedInvoice {
  invoiceId: string;
  allocationId: string;
  netValue: number;
  pendingBalance: number;
  totalReceived: number;
  allocatedAmount: number;
  invoiceNumber: string;
  hospitalName: string;
}

interface MultiInvoiceSelectorProps {
  transactionAmount: number;
  onSelectionChange: (
    selectedInvoices: SelectedInvoice[],
    summary: {
      totalSelected: number;
      difference: number;
      hasAdjustment: boolean;
    }
  ) => void;
}

const formatCNPJ = (cnpj: string) => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function MultiInvoiceSelector({
  transactionAmount,
  onSelectionChange,
}: MultiInvoiceSelectorProps) {
  const { tenantId } = useTenant();
  const [allocations, setAllocations] = useState<InvoiceAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllocations();
  }, [tenantId]);

  const loadAllocations = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoice_allocations")
        .select(`
          id,
          invoice_id,
          allocated_net_value,
          amount_to_pay,
          invoices!invoice_allocations_invoice_id_fkey (
            id,
            tenant_id,
            invoice_number,
            company_name,
            hospital_name,
            issue_date,
            net_value,
            total_received,
            expected_receipt_date,
            status,
            hospitals!invoices_hospital_id_fkey (
              document,
              payer_cnpj_1,
              payer_cnpj_2
            ),
            issuers!invoices_issuer_id_fkey (
              name
            )
          )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Deduplicate by invoice_id — a single invoice may have multiple allocations (one per doctor)
      // but for receipt purposes we only care about the invoice-level pending balance.
      const invoiceMap = new Map<string, any>();
      
      (data || []).forEach((item: any) => {
        if (!tenantId) return;
        if (!item.invoices?.tenant_id) return;
        if (item.invoices.tenant_id !== tenantId) return;
        if (
          item.invoices?.status !== "pendente" &&
          item.invoices?.status !== "parcialmente_recebido"
        ) return;

        // Keep only the first allocation per invoice (we use invoice-level data anyway)
        if (invoiceMap.has(item.invoice_id)) return;

        const netValue = Number(item.invoices.net_value);
        const totalReceived = Number(item.invoices.total_received || 0);
        const pendingBalance = netValue - totalReceived;

        invoiceMap.set(item.invoice_id, {
          id: item.id,
          invoice_id: item.invoice_id,
          allocated_net_value: item.allocated_net_value,
          amount_to_pay: item.amount_to_pay,
          totalReceived,
          pendingBalance,
          invoice: {
            invoice_number: item.invoices.invoice_number,
            company_name: item.invoices.company_name,
            hospital_name: item.invoices.hospital_name,
            hospital_cnpj: item.invoices.hospitals?.document || null,
            payer_cnpj_1: item.invoices.hospitals?.payer_cnpj_1 || null,
            payer_cnpj_2: item.invoices.hospitals?.payer_cnpj_2 || null,
            issue_date: item.invoices.issue_date,
            net_value: netValue,
            total_received: totalReceived,
            expected_receipt_date: item.invoices.expected_receipt_date,
            status: item.invoices.status,
            issuer_name: item.invoices.issuers?.name || null,
          },
        });
      });

      const transformed = Array.from(invoiceMap.values());

      setAllocations(transformed);
    } catch (error) {
      console.error("Error loading allocations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = allocations.filter((a) => {
    const search = searchTerm.toLowerCase();
    return (
      a.invoice.invoice_number.toLowerCase().includes(search) ||
      a.invoice.hospital_name.toLowerCase().includes(search) ||
      (a.invoice.hospital_cnpj || "").toLowerCase().includes(search) ||
      (a.invoice.payer_cnpj_1 || "").toLowerCase().includes(search) ||
      (a.invoice.payer_cnpj_2 || "").toLowerCase().includes(search)
    );
  });

  // Sort by pending balance difference from transaction amount
  const sorted = [...filtered].sort((a, b) => {
    const diffA = Math.abs(a.pendingBalance - transactionAmount);
    const diffB = Math.abs(b.pendingBalance - transactionAmount);
    return diffA - diffB;
  });

  const withMatch = sorted.map((a) => ({
    ...a,
    isExactMatch: Math.abs(a.pendingBalance - transactionAmount) < 0.01,
    isPartial: a.totalReceived > 0,
  }));

  // Calculate selected invoices and summary
  const { selectedInvoices, summary } = useMemo(() => {
    const selected: SelectedInvoice[] = [];
    let totalSelected = 0;

    allocations.forEach((allocation) => {
      if (selectedIds.has(allocation.id)) {
        // Allocate the pending balance (what's still owed)
        const allocatedAmount = allocation.pendingBalance;
        totalSelected += allocatedAmount;
        
        selected.push({
          invoiceId: allocation.invoice_id,
          allocationId: allocation.id,
          netValue: allocation.invoice.net_value,
          pendingBalance: allocation.pendingBalance,
          totalReceived: allocation.totalReceived,
          allocatedAmount,
          invoiceNumber: allocation.invoice.invoice_number,
          hospitalName: allocation.invoice.hospital_name,
        });
      }
    });

    const difference = transactionAmount - totalSelected;
    const hasAdjustment = Math.abs(difference) >= 0.01;

    return {
      selectedInvoices: selected,
      summary: {
        totalSelected,
        difference,
        hasAdjustment,
      },
    };
  }, [selectedIds, allocations, transactionAmount]);

  // Notify parent of changes
  useEffect(() => {
    onSelectionChange(selectedInvoices, summary);
  }, [selectedInvoices, summary, onSelectionChange]);

  const handleToggle = (allocationId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(allocationId)) {
        newSet.delete(allocationId);
      } else {
        newSet.add(allocationId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma nota fiscal rateada pendente</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Selecione as Notas Fiscais para Vincular</Label>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por NF, unidade ou CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[200px] border rounded-md p-2">
        {withMatch.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum resultado encontrado
          </p>
        ) : (
          <div className="space-y-2">
            {withMatch.map((allocation) => {
              const isSelected = selectedIds.has(allocation.id);
              
              return (
                <div
                  key={allocation.id}
                  className={`flex items-center space-x-3 p-2 rounded-md border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/50"
                  } ${allocation.isExactMatch ? "ring-1 ring-green-500" : ""}`}
                  onClick={() => handleToggle(allocation.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(allocation.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            NF {allocation.invoice.invoice_number}
                          </span>
                          {allocation.isPartial && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                              Parcial
                            </Badge>
                          )}
                          {allocation.isExactMatch && (
                            <Badge className="bg-green-600 text-xs">
                              Valor exato
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          <span className="font-medium">Dest:</span> {allocation.invoice.hospital_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {allocation.invoice.hospital_cnpj 
                            ? formatCNPJ(allocation.invoice.hospital_cnpj) 
                            : "CNPJ não informado"}
                          {allocation.invoice.issue_date && (
                            <span className="ml-2">
                              • Emissão: {new Date(allocation.invoice.issue_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </p>
                        {allocation.invoice.issuer_name && (
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            <span className="font-medium">Emit:</span> {allocation.invoice.issuer_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {allocation.isPartial ? (
                          <>
                            <p className="text-xs text-muted-foreground line-through">
                              {formatCurrency(allocation.invoice.net_value)}
                            </p>
                            <p className="font-medium text-sm text-yellow-600">
                              Saldo: {formatCurrency(allocation.pendingBalance)}
                            </p>
                            <p className="text-xs text-green-600">
                              Já recebido: {formatCurrency(allocation.totalReceived)}
                            </p>
                          </>
                        ) : (
                          <p className="font-medium text-sm">
                            {formatCurrency(allocation.invoice.net_value)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Summary Card */}
      {selectedIds.size > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Resumo da Seleção</span>
              <Badge variant="secondary">
                {selectedIds.size} nota{selectedIds.size > 1 ? 's' : ''} selecionada{selectedIds.size > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Valor do Crédito:</span>
                <p className="font-medium text-green-600">{formatCurrency(transactionAmount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total das Notas:</span>
                <p className="font-medium">{formatCurrency(summary.totalSelected)}</p>
              </div>
            </div>

            {/* Difference indicator */}
            <div className={`flex items-center gap-2 p-2 rounded-md ${
              Math.abs(summary.difference) < 0.01 
                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                : summary.difference > 0 
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            }`}>
              {Math.abs(summary.difference) < 0.01 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Valores conferem</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Diferença: {formatCurrency(summary.difference)}
                    {summary.difference > 0 ? ' (sobra)' : ' (falta)'}
                  </span>
                </>
              )}
            </div>

            {/* Selected invoices list */}
            <div className="text-xs text-muted-foreground space-y-1">
              {selectedInvoices.map((inv) => (
                <div key={inv.invoiceId} className="flex justify-between">
                  <span>NF {inv.invoiceNumber}</span>
                  <span>{formatCurrency(inv.allocatedAmount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedIds.size > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleClearSelection}
        >
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
