import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldCheck, Plus, Pencil, Eye, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/config/routes";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { VinculoRTFormDialog } from "@/components/juridico/VinculoRTFormDialog";
import { VinculoRTViewDialog } from "@/components/juridico/VinculoRTViewDialog";
import { computeRTStatus, STATUS_CONFIG, type RTComputedStatus } from "@/utils/rtStatusUtils";
import { cn } from "@/lib/utils";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export type VinculoRT = {
  id: string;
  profissional_id: string;
  empresa_id: string;
  juridico_profissional_id: string | null;
  juridico_empresa_id: string | null;
  conselho_pj: string | null;
  uf_conselho_pj: string | null;
  registro_pj: string | null;
  data_inicio_responsabilidade: string | null;
  data_validade: string | null;
  login_portal_conselho: string | null;
  senha_portal_conselho: string | null;
  observacoes: string | null;
  status: string;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
  juridico_profissionais: { nome: string; registro_conselho: string | null } | null;
  juridico_empresas: { nome: string; cnpj: string | null } | null;
};

export default function JuridicoRTs() {
  useDocumentTitle("Controle de RTs");
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [formOpen, setFormOpen] = useState(false);
  const [editingVinculo, setEditingVinculo] = useState<VinculoRT | null>(null);
  const [viewingVinculo, setViewingVinculo] = useState<VinculoRT | null>(null);

  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterProfissional, setFilterProfissional] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: vinculos, isLoading } = useQuery({
    queryKey: ["vinculos_rt", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vinculos_rt" as any)
        .select("*, juridico_profissionais(nome, registro_conselho), juridico_empresas(nome, cnpj)")
        .eq("tenant_id", tenant?.id)
        .order("data_validade", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as VinculoRT[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch profissionais for filter
  const { data: profissionais } = useQuery({
    queryKey: ["juridico_profissionais", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_profissionais" as any)
        .select("id, nome, registro_conselho")
        .eq("tenant_id", tenant?.id)
        .order("nome");
      if (error) throw error;
      return data as unknown as { id: string; nome: string; registro_conselho: string | null }[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch empresas for filter
  const { data: empresas } = useQuery({
    queryKey: ["juridico_empresas", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_empresas" as any)
        .select("id, nome, cnpj")
        .eq("tenant_id", tenant?.id)
        .order("nome");
      if (error) throw error;
      return data as unknown as { id: string; nome: string; cnpj: string | null }[];
    },
    enabled: !!tenant?.id,
  });

  const filteredVinculos = useMemo(() => {
    if (!vinculos) return [];
    return vinculos
      .map((v) => ({
        ...v,
        _statusInfo: computeRTStatus(v.status, v.data_validade),
      }))
      .filter((v) => {
        if (filterEmpresa !== "all" && (v.juridico_empresa_id || v.empresa_id) !== filterEmpresa) return false;
        if (filterProfissional !== "all" && (v.juridico_profissional_id || v.profissional_id) !== filterProfissional) return false;
        if (filterStatus !== "all" && v._statusInfo.computed !== filterStatus) return false;
        if (filterUf !== "all" && v.uf_conselho_pj !== filterUf) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchName = v.juridico_profissionais?.nome?.toLowerCase().includes(term);
          const matchRegistro = v.juridico_profissionais?.registro_conselho?.toLowerCase().includes(term);
          const matchEmpresa = v.juridico_empresas?.nome?.toLowerCase().includes(term);
          const matchCnpj = v.juridico_empresas?.cnpj?.toLowerCase().includes(term);
          const matchRegPJ = v.registro_pj?.toLowerCase().includes(term);
          if (!matchName && !matchRegistro && !matchEmpresa && !matchCnpj && !matchRegPJ) return false;
        }
        return true;
      });
  }, [vinculos, filterEmpresa, filterProfissional, filterStatus, filterUf, searchTerm]);

  const hasActiveFilters = filterEmpresa !== "all" || filterProfissional !== "all" || filterStatus !== "all" || filterUf !== "all" || searchTerm !== "";

  const clearFilters = () => {
    setFilterEmpresa("all");
    setFilterProfissional("all");
    setFilterStatus("all");
    setFilterUf("all");
    setSearchTerm("");
  };

  const handleEdit = (v: VinculoRT) => {
    setEditingVinculo(v);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingVinculo(null);
    setFormOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Controle de RTs</h1>
              <p className="text-muted-foreground">
                Gerencie os vínculos de Responsabilidade Técnica entre profissionais e empresas.
              </p>
            </div>
          </div>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Vínculo RT
          </Button>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
              <SelectTrigger>
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterProfissional} onValueChange={setFilterProfissional}>
              <SelectTrigger>
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {profissionais?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.entries(STATUS_CONFIG) as [RTComputedStatus, { label: string }][]).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUf} onValueChange={setFilterUf}>
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as UFs</SelectItem>
                {UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filteredVinculos.length} resultado{filteredVinculos.length !== 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" />
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Registro PJ</TableHead>
                <TableHead>Conselho</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !filteredVinculos.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {hasActiveFilters ? "Nenhum resultado encontrado" : "Nenhum vínculo RT cadastrado"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? "Tente ajustar os filtros para encontrar o que procura."
                        : "Clique em \"Novo Vínculo RT\" para começar."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredVinculos.map((v) => {
                  const { label, badgeClass, diasParaVencimento, computed } = v._statusInfo;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.juridico_empresas?.nome || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{v.juridico_empresas?.cnpj || "—"}</TableCell>
                      <TableCell className="font-medium">{v.juridico_profissionais?.nome || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{v.juridico_profissionais?.registro_conselho || "—"}</TableCell>
                      <TableCell>{v.registro_pj || "—"}</TableCell>
                      <TableCell>
                        {v.conselho_pj
                          ? `${v.conselho_pj}${v.uf_conselho_pj ? `/${v.uf_conselho_pj}` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {v.data_validade ? (
                          <div>
                            <span className={cn(
                              "text-sm",
                              computed === "vencido" && "font-semibold text-red-600 dark:text-red-400",
                              computed === "a_vencer" && "font-semibold text-amber-600 dark:text-amber-400",
                            )}>
                              {format(new Date(v.data_validade + "T00:00:00"), "dd/MM/yyyy")}
                            </span>
                            {diasParaVencimento !== null && computed !== "encerrado" && (
                              <p className={cn(
                                "text-xs mt-0.5",
                                computed === "vencido" && "text-red-500 dark:text-red-400",
                                computed === "a_vencer" && "text-amber-500 dark:text-amber-400",
                                computed === "valido" && "text-muted-foreground",
                              )}>
                                {computed === "vencido"
                                  ? `Vencido há ${Math.abs(diasParaVencimento)} dia${Math.abs(diasParaVencimento) !== 1 ? "s" : ""}`
                                  : `${diasParaVencimento} dia${diasParaVencimento !== 1 ? "s" : ""} restante${diasParaVencimento !== 1 ? "s" : ""}`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          badgeClass,
                        )}>
                          {label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Visualizar"
                            onClick={() => navigate(ROUTES.juridico.rtDetail(v.id))}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            onClick={() => handleEdit(v)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <VinculoRTFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingVinculo(null);
          }
        }}
        vinculo={editingVinculo}
        profissionais={profissionais || []}
        empresas={empresas || []}
      />

      <VinculoRTViewDialog
        open={!!viewingVinculo}
        onOpenChange={(open) => { if (!open) setViewingVinculo(null); }}
        vinculo={viewingVinculo}
      />
    </AppLayout>
  );
}
