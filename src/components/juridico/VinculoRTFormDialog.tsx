import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vinculo: VinculoRT | null;
  doctors: { id: string; name: string; crm: string }[];
  issuers: { id: string; name: string; cnpj: string }[];
}

export function VinculoRTFormDialog({ open, onOpenChange, vinculo, doctors, issuers }: Props) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const isEditing = !!vinculo;

  const [form, setForm] = useState<FormData>(emptyForm);

  // Sync form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && vinculo) {
      setForm({
        profissional_id: vinculo.profissional_id,
        empresa_id: vinculo.empresa_id,
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

  // Ensure form is set when vinculo changes while open
  if (open && vinculo && form.profissional_id !== vinculo.profissional_id) {
    setForm({
      profissional_id: vinculo.profissional_id,
      empresa_id: vinculo.empresa_id,
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
        profissional_id: data.profissional_id,
        empresa_id: data.empresa_id,
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
      } else {
        const { error } = await supabase
          .from("vinculos_rt" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vinculos_rt"] });
      toast.success(isEditing ? "Vínculo atualizado com sucesso!" : "Vínculo criado com sucesso!");
      onOpenChange(false);
      setForm(emptyForm);
    },
    onError: (err: any) => {
      if (err?.message?.includes("idx_vinculos_rt_unique")) {
        toast.error("Já existe um vínculo ativo entre este profissional e esta empresa.");
      } else {
        toast.error("Erro ao salvar: " + err.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.profissional_id || !form.empresa_id) {
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Profissional *</Label>
              <Select value={form.profissional_id} onValueChange={(v) => setForm({ ...form, profissional_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
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
                  {issuers.map((i) => (
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
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
