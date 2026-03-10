import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import type { VinculoRT } from "@/pages/juridico/JuridicoRTs";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  inativo: { label: "Inativo", variant: "secondary" },
  vencido: { label: "Vencido", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vinculo: VinculoRT | null;
}

export function VinculoRTViewDialog({ open, onOpenChange, vinculo }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  if (!vinculo) return null;

  const st = STATUS_MAP[vinculo.status] || STATUS_MAP.ativo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes do Vínculo RT
            <Badge variant={st.variant}>{st.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Profissional</h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={vinculo.doctors?.name} />
              <Field label="CRM" value={vinculo.doctors?.crm} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Empresa</h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Razão Social" value={vinculo.issuers?.name} />
              <Field label="CNPJ" value={vinculo.issuers?.cnpj} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Responsabilidade Técnica</h4>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Conselho PJ" value={vinculo.conselho_pj} />
              <Field label="UF" value={vinculo.uf_conselho_pj} />
              <Field label="Registro PJ" value={vinculo.registro_pj} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Field
                label="Início"
                value={
                  vinculo.data_inicio_responsabilidade
                    ? format(new Date(vinculo.data_inicio_responsabilidade + "T00:00:00"), "dd/MM/yyyy")
                    : null
                }
              />
              <Field
                label="Validade"
                value={
                  vinculo.data_validade
                    ? format(new Date(vinculo.data_validade + "T00:00:00"), "dd/MM/yyyy")
                    : null
                }
              />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Acesso ao Portal</h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Login" value={vinculo.login_portal_conselho} />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senha</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground">
                    {vinculo.senha_portal_conselho
                      ? showPassword
                        ? vinculo.senha_portal_conselho
                        : "••••••••"
                      : "—"}
                  </p>
                  {vinculo.senha_portal_conselho && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {vinculo.observacoes && (
            <>
              <Separator />
              <Field label="Observações" value={vinculo.observacoes} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
