import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useRTHistoryLogger } from "@/hooks/useRTHistory";
import { computeRTStatus } from "@/utils/rtStatusUtils";
import { cn } from "@/lib/utils";

interface Props {
  vinculoId: string;
  dataValidadeAtual: string | null;
  statusAtual: string;
}

export function RTRenewalTab({ vinculoId, dataValidadeAtual, statusAtual }: Props) {
  const queryClient = useQueryClient();
  const { logEvent } = useRTHistoryLogger();
  const [novaValidade, setNovaValidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const statusInfo = computeRTStatus(statusAtual, dataValidadeAtual);

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!novaValidade) throw new Error("Informe a nova data de validade.");

      // Update the vinculo
      const { error } = await supabase
        .from("vinculos_rt" as any)
        .update({
          data_validade: novaValidade,
          status: "ativo",
        } as any)
        .eq("id", vinculoId);
      if (error) throw error;

      // Log history event
      await logEvent({
        vinculoRtId: vinculoId,
        tipoEvento: "renovacao",
        descricao: `Renovação: validade alterada de ${dataValidadeAtual || "não definida"} para ${novaValidade}${observacao ? `. Obs: ${observacao}` : ""}`,
        dadosAnteriores: { data_validade: dataValidadeAtual, status: statusAtual },
        dadosNovos: { data_validade: novaValidade, status: "ativo" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vinculo_rt_detail"] });
      queryClient.invalidateQueries({ queryKey: ["vinculos_rt"] });
      queryClient.invalidateQueries({ queryKey: ["historico_vinculos_rt"] });
      toast.success("Vínculo renovado com sucesso!");
      setNovaValidade("");
      setObservacao("");
    },
    onError: (err: any) => {
      toast.error("Erro ao renovar: " + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaValidade) {
      toast.error("Informe a nova data de validade.");
      return;
    }
    renewMutation.mutate();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6">
      {/* Current status */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Situação atual</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validade atual</p>
            <p className="text-sm text-foreground">
              {dataValidadeAtual
                ? format(new Date(dataValidadeAtual + "T00:00:00"), "dd/MM/yyyy")
                : "Não definida"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
            <span className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              statusInfo.badgeClass,
            )}>
              {statusInfo.label}
            </span>
          </div>
          {statusInfo.diasParaVencimento !== null && statusInfo.computed !== "encerrado" && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias</p>
              <p className={cn(
                "text-sm font-medium",
                statusInfo.computed === "vencido" && "text-destructive",
                statusInfo.computed === "a_vencer" && "text-amber-600 dark:text-amber-400",
                statusInfo.computed === "valido" && "text-foreground",
              )}>
                {statusInfo.computed === "vencido"
                  ? `Vencido há ${Math.abs(statusInfo.diasParaVencimento)} dias`
                  : `${statusInfo.diasParaVencimento} dias restantes`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Renewal form */}
      <form onSubmit={handleSubmit} className="space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Renovar vínculo
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nova-validade">Nova data de validade *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="nova-validade"
                type="date"
                value={novaValidade}
                onChange={(e) => setNovaValidade(e.target.value)}
                className="pl-10"
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs-renovacao">Observação</Label>
          <Textarea
            id="obs-renovacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo ou observação da renovação..."
            rows={3}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={renewMutation.isPending}>
            <RefreshCw className={cn("mr-2 h-4 w-4", renewMutation.isPending && "animate-spin")} />
            {renewMutation.isPending ? "Renovando..." : "Renovar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
