import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useRTHistoryLogger } from "@/hooks/useRTHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VinculoRT } from "@/pages/juridico/JuridicoRTs";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo (automático pela validade)" },
  { value: "cancelado", label: "Encerrado (manual)" },
];

type FormData = {
  juridico_profissional_id: string;
  juridico_empresa_id: string;
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
  juridico_profissional_id: "",
  juridico_empresa_id: "",
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vinculo: VinculoRT | null;
  profissionais: { id: string; nome: string; registro_conselho: string | null }[];
  empresas: { id: string; nome: string; cnpj: string | null }[];
}

export function VinculoRTFormDialog({ open, onOpenChange, vinculo, profissionais, empresas }: Props) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const { logEvent } = useRTHistoryLogger();

  const isEditing = !!vinculo;

  const [form, setForm] = useState<FormData>(emptyForm);

  const hasProfissionais = profissionais.length > 0;
  const hasEmpresas = empresas.length > 0;
  const canSubmit = hasProfissionais && hasEmpresas;
  const missingDependenciesMessage = !hasProfissionais && !hasEmpresas
    ? "Cadastre pelo menos um profissional e uma empresa no Jurídico deste tenant antes de criar o vínculo RT."
    : !hasProfissionais
      ? "Cadastre pelo menos um profissional no Jurídico deste tenant antes de criar o vínculo RT."
      : !hasEmpresas
        ? "Cadastre pelo menos uma empresa no Jurídico deste tenant antes de criar o vínculo RT."
        : null;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && vinculo) {
      setForm({
        juridico_profissional_id: vinculo.juridico_profissional_id || vinculo.profissional_id,
        juridico_empresa_id: vinculo.juridico_empresa_id || vinculo.empresa_id,
        conselho_pj: vinculo.conselho_pj || "",
        uf_conselho_pj: vinculo.uf_conselho_pj || "",
        registro_pj: vinculo.registro_pj || "",
        data_inicio_responsabilidade: vinculo.data_inicio_responsabilidade || "",
        data_validade: vinculo.data_validade || "",
        login_portal_conselho: vinculo.login_portal_conselho || "",
        senha_portal_conselho: vinculo.senha_portal_conselho || "",
        observacoes: vinculo.observacoes || "",
        status: vinculo.status,
      });
    } else if (newOpen && !vinculo) {
      setForm(emptyForm);
    }
    setShowPassword(false);
    onOpenChange(newOpen);
  };

  if (open && vinculo && form.juridico_profissional_id !== (vinculo.juridico_profissional_id || vinculo.profissional_id)) {
    setForm({
      juridico_profissional_id: vinculo.juridico_profissional_id || vinculo.profissional_id,
      juridico_empresa_id: vinculo.juridico_empresa_id || vinculo.empresa_id,
      conselho_pj: vinculo.conselho_pj || "",
      uf_conselho_pj: vinculo.uf_conselho_pj || "",
      registro_pj: vinculo.registro_pj || "",
      data_inicio_responsabilidade: vinculo.data_inicio_responsabilidade || "",
      data_validade: vinculo.data_validade || "",
      login_portal_conselho: vinculo.login_portal_conselho || "",
      senha_portal_conselho: vinculo.senha_portal_conselho || "",
      observacoes: vinculo.observacoes || "",
      status: vinculo.status,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        profissional_id: data.juridico_profissional_id,
        empresa_id: data.juridico_empresa_id,
        juridico_profissional_id: data.juridico_profissional_id,
        juridico_empresa_id: data.juridico_empresa_id,
        conselho_pj: data.conselho_pj || null,
        uf_conselho_pj: data.uf_conselho_pj || null,
        registro_pj: data.registro_pj || null,
        data_inicio_responsabilidade: data.data_inicio_responsabilidade || null,
        data_validade: data.data_validade || null,
        login_portal_conselho: data.login_portal_conselho || null,
        senha_portal_conselho: data.senha_portal_conselho || null,
        observacoes: data.observacoes || null,
        status: data.status,
        tenant_id: tenant?.id,
      };

      if (isEditing && vinculo) {
        const { error } = await supabase
          .from("vinculos_rt" as any)
          .update(payload as any)
          .eq("id", vinculo.id);
        if (error) throw error;

        const changes: string[] = [];
        if (vinculo.data_validade !== (data.data_validade || null)) {
          changes.push("validade");
          await logEvent({
            vinculoRtId: vinculo.id,
            tipoEvento: "alteracao_validade",
            descricao: `Validade alterada de ${vinculo.data_validade || "não definida"} para ${data.data_validade || "não definida"}`,
            dadosAnteriores: { data_validade: vinculo.data_validade },
            dadosNovos: { data_validade: data.data_validade },
          });
        }
        if (vinculo.status !== data.status) {
          const tipoEvento = data.status === "cancelado" ? "encerramento" as const : "alteracao_status" as const;
          await logEvent({
            vinculoRtId: vinculo.id,
            tipoEvento,
            descricao: `Status alterado de "${vinculo.status}" para "${data.status}"`,
            dadosAnteriores: { status: vinculo.status },
            dadosNovos: { status: data.status },
          });
        }
        if (changes.length === 0 && vinculo.status === data.status) {
          await logEvent({
            vinculoRtId: vinculo.id,
            tipoEvento: "edicao",
            descricao: "Dados do vínculo atualizados",
            dadosAnteriores: payload,
            dadosNovos: payload,
          });
        }

        return { id: vinculo.id };
      } else {
        const { data: inserted, error } = await supabase
          .from("vinculos_rt" as any)
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;

        await logEvent({
          vinculoRtId: (inserted as any).id,
          tipoEvento: "criacao",
          descricao: "Vínculo RT criado",
          dadosNovos: payload as any,
        });

        return inserted;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vinculos_rt"] });
      queryClient.invalidateQueries({ queryKey: ["vinculo_rt_detail"] });
      queryClient.invalidateQueries({ queryKey: ["historico_vinculos_rt"] });
      toast.success(isEditing ? "Vínculo atualizado com sucesso!" : "Vínculo criado com sucesso!");
      onOpenChange(false);
      setForm(emptyForm);
    },
    onError: (err: any) => {
      console.error("Erro ao salvar vínculo RT:", err, JSON.stringify(err));
      if (err?.message?.includes("idx_vinculos_rt_unique")) {
        toast.error("Já existe um vínculo ativo entre este profissional e esta empresa.");
      } else {
        toast.error("Erro ao salvar: " + err.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      toast.error(missingDependenciesMessage || "Cadastros obrigatórios não encontrados para este tenant.");
      return;
    }

    if (!form.juridico_profissional_id || !form.juridico_empresa_id) {
      toast.error("Selecione o profissional e a empresa.");
      return;
    }

    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Vínculo RT" : "Novo Vínculo RT"}</DialogTitle>
        </DialogHeader>
        {missingDependenciesMessage && (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
            {missingDependenciesMessage}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Profissional *</Label>
              <Select
                value={form.juridico_profissional_id}
                onValueChange={(v) => setForm({ ...form, juridico_profissional_id: v })}
                disabled={!hasProfissionais}
              >
                <SelectTrigger>
                  <SelectValue placeholder={hasProfissionais ? "Selecione..." : "Nenhum profissional cadastrado"} />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.registro_conselho ? `(${p.registro_conselho})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select
                value={form.juridico_empresa_id}
                onValueChange={(v) => setForm({ ...form, juridico_empresa_id: v })}
                disabled={!hasEmpresas}
              >
                <SelectTrigger>
                  <SelectValue placeholder={hasEmpresas ? "Selecione..." : "Nenhuma empresa cadastrada"} />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome} {e.cnpj ? `(${e.cnpj})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Conselho PJ</Label>
              <Input
                value={form.conselho_pj}
                onChange={(e) => setForm({ ...form, conselho_pj: e.target.value })}
                placeholder="Ex: CRMV, CRO..."
              />
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
              <Input
                value={form.registro_pj}
                onChange={(e) => setForm({ ...form, registro_pj: e.target.value })}
                placeholder="Nº registro"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Início Responsabilidade</Label>
              <Input
                type="date"
                value={form.data_inicio_responsabilidade}
                onChange={(e) => setForm({ ...form, data_inicio_responsabilidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input
                type="date"
                value={form.data_validade}
                onChange={(e) => setForm({ ...form, data_validade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Login Portal Conselho</Label>
              <Input
                value={form.login_portal_conselho}
                onChange={(e) => setForm({ ...form, login_portal_conselho: e.target.value })}
                placeholder="Login"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha Portal Conselho</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.senha_portal_conselho}
                  onChange={(e) => setForm({ ...form, senha_portal_conselho: e.target.value })}
                  placeholder="Senha"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || !canSubmit}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
