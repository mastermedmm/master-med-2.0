import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldCheck, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  inativo: { label: "Inativo", variant: "secondary" },
  vencido: { label: "Vencido", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

type VinculoRT = {
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

type FormData = {
  profissional_id: string;
  empresa_id: string;
  conselho_pj: string;
  uf_conselho_pj: string;
  registro_pj: string;
  data_inicio_responsabilidade: string;
  data_validade: string;
  login_portal_conselho: string;
  senha_portal_conselho: string;
  observacoes: string;
  status: string;
};

const emptyForm: FormData = {
  profissional_id: "",
  empresa_id: "",
  conselho_pj: "",
  uf_conselho_pj: "",
  registro_pj: "",
  data_inicio_responsabilidade: "",
  data_validade: "",
  login_portal_conselho: "",
  senha_portal_conselho: "",
  observacoes: "",
  status: "ativo",
};

export default function JuridicoRTs() {
  useDocumentTitle("Controle de RTs");
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Fetch vínculos
  const { data: vinculos, isLoading } = useQuery({
    queryKey: ["vinculos_rt", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vinculos_rt" as any)
        .select("*, doctors(name, crm), issuers(name, cnpj)")
        .eq("tenant_id", tenant?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as VinculoRT[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch doctors
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

  // Fetch issuers (empresas)
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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        tenant_id: tenant?.id,
        data_inicio_responsabilidade: data.data_inicio_responsabilidade || null,
        data_validade: data.data_validade || null,
        conselho_pj: data.conselho_pj || null,
        uf_conselho_pj: data.uf_conselho_pj || null,
        registro_pj: data.registro_pj || null,
        login_portal_conselho: data.login_portal_conselho || null,
        senha_portal_conselho: data.senha_portal_conselho || null,
        observacoes: data.observacoes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("vinculos_rt" as any)
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vinculos_rt" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vinculos_rt"] });
      toast.success(editingId ? "Vínculo atualizado!" : "Vínculo criado!");
      handleCloseDialog();
    },
    onError: (err: any) => {
      if (err?.message?.includes("idx_vinculos_rt_unique")) {
        toast.error("Já existe um vínculo ativo entre este profissional e esta empresa.");
      } else {
        toast.error("Erro ao salvar: " + err.message);
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vinculos_rt" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vinculos_rt"] });
      toast.success("Vínculo excluído!");
      setDeleteId(null);
    },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (v: VinculoRT) => {
    setEditingId(v.id);
    setForm({
      profissional_id: v.profissional_id,
      empresa_id: v.empresa_id,
      conselho_pj: v.conselho_pj || "",
      uf_conselho_pj: v.uf_conselho_pj || "",
      registro_pj: v.registro_pj || "",
      data_inicio_responsabilidade: v.data_inicio_responsabilidade || "",
      data_validade: v.data_validade || "",
      login_portal_conselho: v.login_portal_conselho || "",
      senha_portal_conselho: v.senha_portal_conselho || "",
      observacoes: v.observacoes || "",
      status: v.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.profissional_id || !form.empresa_id) {
      toast.error("Selecione o profissional e a empresa.");
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
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
          <Button onClick={() => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Vínculo
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Conselho PJ</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Registro PJ</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !vinculos?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum vínculo RT cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                vinculos.map((v) => {
                  const st = STATUS_MAP[v.status] || STATUS_MAP.ativo;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-medium">{v.doctors?.name}</div>
                        <div className="text-xs text-muted-foreground">CRM: {v.doctors?.crm}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{v.issuers?.name}</div>
                        <div className="text-xs text-muted-foreground">{v.issuers?.cnpj}</div>
                      </TableCell>
                      <TableCell>{v.conselho_pj || "—"}</TableCell>
                      <TableCell>{v.uf_conselho_pj || "—"}</TableCell>
                      <TableCell>{v.registro_pj || "—"}</TableCell>
                      <TableCell>
                        {v.data_inicio_responsabilidade
                          ? format(new Date(v.data_inicio_responsabilidade + "T00:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {v.data_validade
                          ? format(new Date(v.data_validade + "T00:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Vínculo RT" : "Novo Vínculo RT"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Profissional *</Label>
                  <Select value={form.profissional_id} onValueChange={(v) => setForm({ ...form, profissional_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {doctors?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} (CRM: {d.crm})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {issuers?.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Conselho PJ</Label>
                  <Input value={form.conselho_pj} onChange={(e) => setForm({ ...form, conselho_pj: e.target.value })} placeholder="Ex: CRMV, CRO..." />
                </div>
                <div className="space-y-2">
                  <Label>UF Conselho</Label>
                  <Select value={form.uf_conselho_pj} onValueChange={(v) => setForm({ ...form, uf_conselho_pj: v })}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Registro PJ</Label>
                  <Input value={form.registro_pj} onChange={(e) => setForm({ ...form, registro_pj: e.target.value })} placeholder="Nº registro" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Início Responsabilidade</Label>
                  <Input type="date" value={form.data_inicio_responsabilidade} onChange={(e) => setForm({ ...form, data_inicio_responsabilidade: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <Input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Login Portal Conselho</Label>
                  <Input value={form.login_portal_conselho} onChange={(e) => setForm({ ...form, login_portal_conselho: e.target.value })} placeholder="Login" />
                </div>
                <div className="space-y-2">
                  <Label>Senha Portal Conselho</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords["form"] ? "text" : "password"}
                      value={form.senha_portal_conselho}
                      onChange={(e) => setForm({ ...form, senha_portal_conselho: e.target.value })}
                      placeholder="Senha"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPasswords((p) => ({ ...p, form: !p.form }))}
                    >
                      {showPasswords["form"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações gerais sobre o vínculo..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir vínculo RT?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O vínculo será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
