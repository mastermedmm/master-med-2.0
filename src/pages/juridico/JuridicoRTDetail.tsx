import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldCheck, ArrowLeft, Pencil } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { computeRTStatus } from "@/utils/rtStatusUtils";
import { VinculoRTFormDialog } from "@/components/juridico/VinculoRTFormDialog";
import { RTHistoryTab } from "@/components/juridico/RTHistoryTab";
import { RTRenewalTab } from "@/components/juridico/RTRenewalTab";
import { RTAttachmentsTab } from "@/components/juridico/RTAttachmentsTab";
import { ROUTES } from "@/config/routes";
import { Eye, EyeOff } from "lucide-react";
import type { VinculoRT } from "@/pages/juridico/JuridicoRTs";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

export default function JuridicoRTDetail() {
  useDocumentTitle("Detalhe do Vínculo RT");
  const { tenant } = useTenant();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: vinculo, isLoading } = useQuery({
    queryKey: ["vinculo_rt_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vinculos_rt" as any)
        .select("*, juridico_profissionais(nome, registro_conselho, cpf, telefone, email), juridico_empresas(nome, cnpj, cidade, uf)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as VinculoRT & {
        juridico_profissionais: { nome: string; registro_conselho: string | null; cpf: string | null; telefone: string | null; email: string | null } | null;
        juridico_empresas: { nome: string; cnpj: string | null; cidade: string | null; uf: string | null } | null;
      };
    },
    enabled: !!id && !!tenant?.id,
  });

  // Fetch profissionais and empresas for edit dialog
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!vinculo) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Vínculo não encontrado.</p>
          <Button variant="link" onClick={() => navigate(ROUTES.juridico.rts)}>
            Voltar para a lista
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = computeRTStatus(vinculo.status, vinculo.data_validade);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.juridico.rts)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <ShieldCheck className="h-7 w-7 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {vinculo.juridico_empresas?.nome || "Vínculo RT"}
                </h1>
                <span className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  statusInfo.badgeClass,
                )}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {vinculo.juridico_profissionais?.nome} — {vinculo.juridico_profissionais?.registro_conselho || "Sem registro"}
              </p>
            </div>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dados">Dados gerais</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="renovacao">Renovação</TabsTrigger>
          </TabsList>

          {/* Dados gerais */}
          <TabsContent value="dados" className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
              {/* Empresa */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Empresa vinculada</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Razão Social" value={vinculo.juridico_empresas?.nome} />
                  <Field label="CNPJ" value={vinculo.juridico_empresas?.cnpj} />
                  <Field label="Cidade" value={vinculo.juridico_empresas?.cidade} />
                  <Field label="UF" value={vinculo.juridico_empresas?.uf} />
                </div>
              </div>

              <Separator />

              {/* Profissional */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Profissional vinculado</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Nome" value={vinculo.juridico_profissionais?.nome} />
                  <Field label="Registro" value={vinculo.juridico_profissionais?.registro_conselho} />
                  <Field label="CPF" value={vinculo.juridico_profissionais?.cpf} />
                  <Field label="Telefone" value={vinculo.juridico_profissionais?.telefone} />
                </div>
              </div>

              <Separator />

              {/* RT data */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Dados da Responsabilidade Técnica</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Conselho PJ" value={
                    vinculo.conselho_pj
                      ? `${vinculo.conselho_pj}${vinculo.uf_conselho_pj ? `/${vinculo.uf_conselho_pj}` : ""}`
                      : null
                  } />
                  <Field label="Registro PJ" value={vinculo.registro_pj} />
                  <Field label="Status" value={
                    <span className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      statusInfo.badgeClass,
                    )}>
                      {statusInfo.label}
                    </span>
                  } />
                  <Field label="Início Responsabilidade" value={
                    vinculo.data_inicio_responsabilidade
                      ? format(new Date(vinculo.data_inicio_responsabilidade + "T00:00:00"), "dd/MM/yyyy")
                      : null
                  } />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validade</p>
                    {vinculo.data_validade ? (
                      <div>
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
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">—</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Portal access */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Acesso ao Portal do Conselho</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Login" value={vinculo.login_portal_conselho} />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senha</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-foreground">
                        {vinculo.senha_portal_conselho
                          ? showPassword ? vinculo.senha_portal_conselho : "••••••••"
                          : "—"}
                      </p>
                      {vinculo.senha_portal_conselho && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPassword(!showPassword)}>
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
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <RTHistoryTab vinculoId={vinculo.id} />
          </TabsContent>

          <TabsContent value="anexos">
            <RTAttachmentsTab vinculoId={vinculo.id} />
          </TabsContent>

          <TabsContent value="renovacao">
            <RTRenewalTab
              vinculoId={vinculo.id}
              dataValidadeAtual={vinculo.data_validade}
              statusAtual={vinculo.status}
            />
          </TabsContent>
        </Tabs>
      </div>

      <VinculoRTFormDialog
        open={formOpen}
        onOpenChange={(open) => { if (!open) setFormOpen(false); }}
        vinculo={vinculo}
        profissionais={profissionais || []}
        empresas={empresas || []}
      />
    </AppLayout>
  );
}
