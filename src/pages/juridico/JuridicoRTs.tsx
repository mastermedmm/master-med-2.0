import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldCheck, Plus, Pencil, Eye, Search, X } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { VinculoRTFormDialog } from "@/components/juridico/VinculoRTFormDialog";
import { VinculoRTViewDialog } from "@/components/juridico/VinculoRTViewDialog";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  inativo: { label: "Inativo", variant: "secondary" },
  vencido: { label: "Vencido", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export type VinculoRT = {
  id: string;
  profissional_id: string;
  empresa_id: string;
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
  doctors: { name: string; crm: string } | null;
  issuers: { name: string; cnpj: string } | null;
};

export default function JuridicoRTs() {
  useDocumentTitle("Controle de RTs");
  const { tenant } = useTenant();

  const [formOpen, setFormOpen] = useState(false);
  const [editingVinculo, setEditingVinculo] = useState<VinculoRT | null>(null);
  const [viewingVinculo, setViewingVinculo] = useState<VinculoRT | null>(null);

  // Filters
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterProfissional, setFilterProfissional] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch vínculos
  const { data: vinculos, isLoading } = useQuery({
    queryKey: ["vinculos_rt", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vinculos_rt" as any)
        .select("*, doctors(name, crm), issuers(name, cnpj)")
        .eq("tenant_id", tenant?.id)
        .order("data_validade", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as VinculoRT[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch doctors for filter
  const { data: doctors } = useQuery({
    queryKey: ["doctors_list", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, crm")
        .eq("tenant_id", tenant?.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch issuers for filter
  const { data: issuers } = useQuery({
    queryKey: ["issuers_list", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issuers")
        .select("id, name, cnpj")
        .eq("tenant_id", tenant?.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Filtered and sorted data
  const filteredVinculos = useMemo(() => {
    if (!vinculos) return [];
    return vinculos.filter((v) => {
      if (filterEmpresa !== "all" && v.empresa_id !== filterEmpresa) return false;
      if (filterProfissional !== "all" && v.profissional_id !== filterProfissional) return false;
      if (filterStatus !== "all" && v.status !== filterStatus) return false;
      if (filterUf !== "all" && v.uf_conselho_pj !== filterUf) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = v.doctors?.name?.toLowerCase().includes(term);
        const matchCrm = v.doctors?.crm?.toLowerCase().includes(term);
        const matchEmpresa = v.issuers?.name?.toLowerCase().includes(term);
        const matchCnpj = v.issuers?.cnpj?.toLowerCase().includes(term);
        const matchRegistro = v.registro_pj?.toLowerCase().includes(term);
        if (!matchName && !matchCrm && !matchEmpresa && !matchCnpj && !matchRegistro) return false;
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Controle de RTs
              </h1>
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
                {issuers?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterProfissional} onValueChange={setFilterProfissional}>
              <SelectTrigger>
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
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
                <TableHead>CRM</TableHead>
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
                  const st = STATUS_MAP[v.status] || STATUS_MAP.ativo;
                  const isExpiringSoon =
                    v.data_validade &&
                    v.status === "ativo" &&
                    new Date(v.data_validade + "T00:00:00") <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.issuers?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{v.issuers?.cnpj || "—"}</TableCell>
                      <TableCell className="font-medium">{v.doctors?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{v.doctors?.crm || "—"}</TableCell>
                      <TableCell>{v.registro_pj || "—"}</TableCell>
                      <TableCell>
                        {v.conselho_pj
                          ? `${v.conselho_pj}${v.uf_conselho_pj ? `/${v.uf_conselho_pj}` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {v.data_validade ? (
                          <span className={isExpiringSoon ? "font-semibold text-destructive" : ""}>
                            {format(new Date(v.data_validade + "T00:00:00"), "dd/MM/yyyy")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Visualizar"
                            onClick={() => setViewingVinculo(v)}
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

      {/* Dialogs */}
      <VinculoRTFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingVinculo(null);
          }
        }}
        vinculo={editingVinculo}
        doctors={doctors || []}
        issuers={issuers || []}
      />

      <VinculoRTViewDialog
        open={!!viewingVinculo}
        onOpenChange={(open) => { if (!open) setViewingVinculo(null); }}
        vinculo={viewingVinculo}
      />
    </AppLayout>
  );
}
