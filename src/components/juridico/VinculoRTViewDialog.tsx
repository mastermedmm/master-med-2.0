import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { computeRTStatus } from "@/utils/rtStatusUtils";
import type { VinculoRT } from "@/pages/juridico/JuridicoRTs";

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

  const statusInfo = computeRTStatus(vinculo.status, vinculo.data_validade);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes do Vínculo RT
            <span className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              statusInfo.badgeClass,
            )}>
              {statusInfo.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Profissional</h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={vinculo.juridico_profissionais?.nome} />
              <Field label="Registro" value={vinculo.juridico_profissionais?.registro_conselho} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Empresa</h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Razão Social" value={vinculo.juridico_empresas?.nome} />
              <Field label="CNPJ" value={vinculo.juridico_empresas?.cnpj} />
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
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validade</p>
                <div>
                  {vinculo.data_validade ? (
                    <>
                      <p className="text-sm text-foreground">
                        {format(new Date(vinculo.data_validade + "T00:00:00"), "dd/MM/yyyy")}
                      </p>
                      {statusInfo.diasParaVencimento !== null && statusInfo.computed !== "encerrado" && (
                        <p className={cn(
                          "text-xs mt-0.5",
                          statusInfo.computed === "vencido" && "text-red-500",
                          statusInfo.computed === "a_vencer" && "text-amber-500",
                          statusInfo.computed === "valido" && "text-muted-foreground",
                        )}>
                          {statusInfo.computed === "vencido"
                            ? `Vencido há ${Math.abs(statusInfo.diasParaVencimento)} dias`
                            : `${statusInfo.diasParaVencimento} dias restantes`}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-foreground">—</p>
                  )}
                </div>
              </div>
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
