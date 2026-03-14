import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileSignature, Plus, Pencil, Search, X, AlertTriangle } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContratoFormDialog } from "@/components/juridico/ContratoFormDialog";
import { computeContratoStatus, getAlertLevel } from "@/utils/contratoStatusUtils";

export default function JuridicoContratos() {
  useDocumentTitle("Controle de Contratos");
  const { tenantId } = useTenant();
  const { canCreate, canUpdate } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<any>(null);
  const [searchFornecedor, setSearchFornecedor] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterEmpresa, setFilterEmpresa] = useState("todas");

  const { data: contratos = [], isLoading, refetch } = useQuery({
    queryKey: ["contratos", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*, juridico_empresas:juridico_empresa_id(nome, cnpj)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    contratos.forEach((c: any) => {
      if (c.juridico_empresas) map.set(c.juridico_empresa_id, c.juridico_empresas.nome);
    });
    return Array.from(map.entries());
  }, [contratos]);

  const filtered = useMemo(() => {
    return contratos.filter((c: any) => {
      if (searchFornecedor && !c.fornecedor_nome.toLowerCase().includes(searchFornecedor.toLowerCase())) return false;
      if (filterEmpresa !== "todas" && c.juridico_empresa_id !== filterEmpresa) return false;
      if (filterStatus !== "todos") {
        const st = computeContratoStatus(c.status, c.data_vencimento);
        if (st.computed !== filterStatus) return false;
      }
      return true;
    });
  }, [contratos, searchFornecedor, filterStatus, filterEmpresa]);

  const hasActiveFilters = searchFornecedor || filterStatus !== "todos" || filterEmpresa !== "todas";

  const clearFilters = () => {
    setSearchFornecedor("");
    setFilterStatus("todos");
    setFilterEmpresa("todas");
  };

  const handleEdit = (c: any) => {
    setEditingContrato(c);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingContrato(null);
    setFormOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSignature className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Controle de Contratos</h1>
              <p className="text-muted-foreground">Gerencie os contratos do departamento jurídico.</p>
            </div>
          </div>
          {canCreate("juridico.contratos") && (
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Contrato
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor..."
              value={searchFornecedor}
              onChange={(e) => setSearchFornecedor(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresas.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="valido">Válido</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Contratação</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum contrato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => {
                  const statusInfo = computeContratoStatus(c.status, c.data_vencimento);
                  const alert = getAlertLevel(statusInfo.diasParaVencimento);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.juridico_empresas?.nome || "—"}</TableCell>
                      <TableCell>{c.fornecedor_nome}</TableCell>
                      <TableCell>{format(new Date(c.data_contratacao + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        {c.data_vencimento
                          ? format(new Date(c.data_vencimento + "T00:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", statusInfo.badgeClass)}>
                            {statusInfo.label}
                          </Badge>
                          {alert && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>{alert}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canUpdate("juridico.contratos") && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ContratoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetch}
        contrato={editingContrato}
      />
    </AppLayout>
  );
}
