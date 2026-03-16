import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

interface Profissional {
  id: string;
  nome: string;
  cpf: string | null;
  registro_conselho: string | null;
  tipo_conselho: string | null;
  uf_conselho: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  tenant_id: string | null;
}

const emptyForm = {
  nome: "",
  cpf: "",
  registro_conselho: "",
  tipo_conselho: "",
  uf_conselho: "",
  telefone: "",
  email: "",
  observacoes: "",
};

export default function JuridicoProfissionais() {
  useDocumentTitle("Profissionais - Jurídico");
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profissional | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ["juridico_profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_profissionais" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as unknown as Profissional[];
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm) return profissionais;
    const term = searchTerm.toLowerCase();
    return profissionais.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.cpf?.includes(term) ||
        p.registro_conselho?.toLowerCase().includes(term)
    );
  }, [profissionais, searchTerm]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Profissional) => {
    setEditing(p);
    setForm({
      nome: p.nome,
      cpf: p.cpf || "",
      registro_conselho: p.registro_conselho || "",
      tipo_conselho: p.tipo_conselho || "",
      uf_conselho: p.uf_conselho || "",
      telefone: p.telefone || "",
      email: p.email || "",
      observacoes: p.observacoes || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        cpf: form.cpf || null,
        registro_conselho: form.registro_conselho || null,
        tipo_conselho: form.tipo_conselho || null,
        uf_conselho: form.uf_conselho || null,
        telefone: form.telefone || null,
        email: form.email || null,
        observacoes: form.observacoes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("juridico_profissionais" as any)
          .update(payload as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("juridico_profissionais" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["juridico_profissionais"] });
      toast.success(editing ? "Profissional atualizado!" : "Profissional cadastrado!");
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("juridico_profissionais" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["juridico_profissionais"] });
      toast.success("Profissional excluído!");
    },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) {
      toast.error("Nome é obrigatório.");
      return;
    }
    saveMutation.mutate();
  };

  const handleDelete = (p: Profissional) => {
    if (!confirm(`Excluir o profissional "${p.nome}"?`)) return;
    deleteMutation.mutate(p.id);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Profissionais</h1>
              <p className="text-muted-foreground">Cadastro de profissionais do módulo jurídico.</p>
            </div>
          </div>
          {canCreate("juridico.profissionais") && (
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Profissional
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou registro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Conselho/UF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
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
                    Nenhum profissional encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="font-mono text-sm">{p.cpf || "—"}</TableCell>
                    <TableCell>{p.registro_conselho || "—"}</TableCell>
                    <TableCell>
                      {p.tipo_conselho
                        ? `${p.tipo_conselho}${p.uf_conselho ? `/${p.uf_conselho}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>{p.telefone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canUpdate("juridico.profissionais") && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete("juridico.profissionais") && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Profissional" : "Novo Profissional"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="grid gap-2">
                <Label>Registro no Conselho</Label>
                <Input value={form.registro_conselho} onChange={(e) => setForm({ ...form, registro_conselho: e.target.value })} placeholder="Ex: 12345" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Conselho</Label>
                <Input value={form.tipo_conselho} onChange={(e) => setForm({ ...form, tipo_conselho: e.target.value })} placeholder="Ex: CRM, CRMV, CRO" />
              </div>
              <div className="grid gap-2">
                <Label>UF Conselho</Label>
                <Select value={form.uf_conselho} onValueChange={(v) => setForm({ ...form, uf_conselho: v })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
