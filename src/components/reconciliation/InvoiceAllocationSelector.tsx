import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { FileText, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
interface InvoiceAllocation {
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
    net_value: number;
    total_received: number;
    expected_receipt_date: string;
    status: string;
  };
}

interface InvoiceAllocationSelectorProps {
  transactionAmount: number;
  onSelect: (
    allocation: InvoiceAllocation | null, 
    isExactMatch: boolean, 
    invoiceData: { 
      invoiceId: string; 
      netValue: number; 
      pendingBalance: number;
      totalReceived: number;
      isPartial: boolean;
    } | null
  ) => void;
  selectedId: string | null;
}

const formatCNPJ = (cnpj: string) => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
};

export function InvoiceAllocationSelector({
  transactionAmount,
  onSelect,
  selectedId,
}: InvoiceAllocationSelectorProps) {
  const { tenantId } = useTenant();
  const [allocations, setAllocations] = useState<InvoiceAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadAllocations();
  }, [tenantId]);

  const loadAllocations = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      // FILTERED BY TENANT - isolamento de dados por empresa
      const { data, error } = await supabase
        .from("invoice_allocations")
        .select(`
          id,
          invoice_id,
          allocated_net_value,
          amount_to_pay,
          invoices!invoice_allocations_invoice_id_fkey (
            invoice_number,
            company_name,
            hospital_name,
            net_value,
            total_received,
            expected_receipt_date,
            status,
            hospitals!invoices_hospital_id_fkey (
              document,
              payer_cnpj_1,
              payer_cnpj_2
            )
          )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter for pendente AND parcialmente_recebido
      const transformed = (data || [])
        .filter((item: any) => 
          item.invoices?.status === "pendente" || 
          item.invoices?.status === "parcialmente_recebido"
        )
        .map((item: any) => {
          const netValue = Number(item.invoices.net_value);
          const totalReceived = Number(item.invoices.total_received || 0);
          const pendingBalance = netValue - totalReceived;
          
          return {
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
              net_value: netValue,
              total_received: totalReceived,
              expected_receipt_date: item.invoices.expected_receipt_date,
              status: item.invoices.status,
            },
          };
        });

      setAllocations(transformed);
    } catch (error) {
      console.error("Error loading allocations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
      <Label>Vincular a Nota Fiscal Rateada</Label>
      
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
        <RadioGroup
          value={selectedId || ""}
          onValueChange={(value) => {
            const allocation = allocations.find((a) => a.id === value);
            const isExact = allocation 
              ? Math.abs(allocation.pendingBalance - transactionAmount) < 0.01 
              : false;
            const invoiceData = allocation 
              ? { 
                  invoiceId: allocation.invoice_id, 
                  netValue: allocation.invoice.net_value,
                  pendingBalance: allocation.pendingBalance,
                  totalReceived: allocation.totalReceived,
                  isPartial: allocation.totalReceived > 0,
                }
              : null;
            onSelect(allocation || null, isExact, invoiceData);
          }}
        >
          {withMatch.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum resultado encontrado
            </p>
          ) : (
            <div className="space-y-2">
                {withMatch.map((allocation) => (
                <div
                  key={allocation.id}
                  className={`flex items-center space-x-3 p-2 rounded-md border ${
                    selectedId === allocation.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/50"
                  } ${allocation.isExactMatch ? "ring-1 ring-green-500" : ""}`}
                >
                  <RadioGroupItem value={allocation.id} id={allocation.id} />
                  <label
                    htmlFor={allocation.id}
                    className="flex-1 cursor-pointer"
                  >
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
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {allocation.invoice.hospital_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {allocation.invoice.hospital_cnpj 
                            ? formatCNPJ(allocation.invoice.hospital_cnpj) 
                            : "CNPJ não informado"}
                        </p>
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
                  </label>
                </div>
              ))}
            </div>
          )}
        </RadioGroup>
      </ScrollArea>

      {selectedId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => onSelect(null, false, null)}
        >
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
