import { useRTHistoryEvents, EVENT_LABELS } from "@/hooks/useRTHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { History, Plus, Pencil, Calendar, ToggleRight, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<string, typeof History> = {
  criacao: Plus,
  edicao: Pencil,
  alteracao_validade: Calendar,
  alteracao_status: ToggleRight,
  encerramento: XCircle,
  renovacao: RefreshCw,
};

const EVENT_COLORS: Record<string, string> = {
  criacao: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  edicao: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
  alteracao_validade: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  alteracao_status: "text-purple-600 bg-purple-500/10 dark:text-purple-400",
  encerramento: "text-red-600 bg-red-500/10 dark:text-red-400",
};

interface Props {
  vinculoId: string;
}

export function RTHistoryTab({ vinculoId }: Props) {
  const { data: events, isLoading } = useRTHistoryEvents(vinculoId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">Nenhum evento registrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Os eventos serão registrados automaticamente ao criar ou editar este vínculo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-6">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.tipo_evento] || History;
            const colorClass = EVENT_COLORS[event.tipo_evento] || "text-muted-foreground bg-muted";
            const label = EVENT_LABELS[event.tipo_evento as keyof typeof EVENT_LABELS] || event.tipo_evento;

            return (
              <div key={event.id} className="relative flex gap-4 pl-0">
                {/* Icon */}
                <div className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border",
                  colorClass,
                )}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{event.descricao}</p>
                  {event.usuario_nome && (
                    <p className="text-xs text-muted-foreground mt-1">por {event.usuario_nome}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
