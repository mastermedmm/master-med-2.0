import { differenceInDays } from "date-fns";

export type ContratoComputedStatus = "valido" | "a_vencer" | "vencido" | "encerrado";

export interface ContratoStatusInfo {
  computed: ContratoComputedStatus;
  label: string;
  badgeClass: string;
  diasParaVencimento: number | null;
}

const STATUS_CONFIG: Record<ContratoComputedStatus, { label: string; badgeClass: string }> = {
  valido: {
    label: "Válido",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  },
  a_vencer: {
    label: "A vencer",
    badgeClass: "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400",
  },
  vencido: {
    label: "Vencido",
    badgeClass: "bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400",
  },
  encerrado: {
    label: "Encerrado",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export function computeContratoStatus(dbStatus: string, dataVencimento: string | null): ContratoStatusInfo {
  if (dbStatus === "encerrado") {
    return { computed: "encerrado", diasParaVencimento: null, ...STATUS_CONFIG.encerrado };
  }

  if (!dataVencimento) {
    return { computed: "valido", diasParaVencimento: null, ...STATUS_CONFIG.valido };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento + "T00:00:00");
  const dias = differenceInDays(vencimento, hoje);

  if (dias < 0) {
    return { computed: "vencido", diasParaVencimento: dias, ...STATUS_CONFIG.vencido };
  }
  if (dias <= 30) {
    return { computed: "a_vencer", diasParaVencimento: dias, ...STATUS_CONFIG.a_vencer };
  }
  return { computed: "valido", diasParaVencimento: dias, ...STATUS_CONFIG.valido };
}

export function getAlertLevel(dias: number | null): string | null {
  if (dias === null || dias < 0) return null;
  if (dias <= 1) return "Vence amanhã!";
  if (dias <= 7) return `Vence em ${dias} dias`;
  if (dias <= 15) return `Vence em ${dias} dias`;
  if (dias <= 30) return `Vence em ${dias} dias`;
  return null;
}

export { STATUS_CONFIG as CONTRATO_STATUS_CONFIG };
