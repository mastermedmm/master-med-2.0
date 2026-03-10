import { differenceInDays } from "date-fns";

/**
 * Status visual calculado com base na data_validade.
 * O status no banco permanece com o enum original (ativo, inativo, vencido, cancelado).
 * O campo "encerrado" é o único definido manualmente pelo usuário (mapeado para "cancelado" no DB).
 */

export type RTComputedStatus = "valido" | "a_vencer" | "vencido" | "encerrado";

export interface RTStatusInfo {
  computed: RTComputedStatus;
  label: string;
  badgeClass: string;
  diasParaVencimento: number | null;
}

const STATUS_CONFIG: Record<RTComputedStatus, { label: string; badgeClass: string }> = {
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

/**
 * Calcula o status automático de um vínculo RT.
 *
 * Regras:
 * - Se o status no DB é "cancelado" → "encerrado" (manual, não é sobrescrito)
 * - Se não há data_validade → "valido" (sem vencimento definido)
 * - Se data_validade já passou → "vencido"
 * - Se faltam 0–30 dias → "a_vencer"
 * - Se faltam mais de 30 dias → "valido"
 */
export function computeRTStatus(dbStatus: string, dataValidade: string | null): RTStatusInfo {
  // Status manual "encerrado" (cancelado no DB) nunca é sobrescrito
  if (dbStatus === "cancelado") {
    return {
      computed: "encerrado",
      diasParaVencimento: null,
      ...STATUS_CONFIG.encerrado,
    };
  }

  // Sem data de validade → considerado válido
  if (!dataValidade) {
    return {
      computed: "valido",
      diasParaVencimento: null,
      ...STATUS_CONFIG.valido,
    };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade + "T00:00:00");
  const dias = differenceInDays(validade, hoje);

  if (dias < 0) {
    return {
      computed: "vencido",
      diasParaVencimento: dias,
      ...STATUS_CONFIG.vencido,
    };
  }

  if (dias <= 30) {
    return {
      computed: "a_vencer",
      diasParaVencimento: dias,
      ...STATUS_CONFIG.a_vencer,
    };
  }

  return {
    computed: "valido",
    diasParaVencimento: dias,
    ...STATUS_CONFIG.valido,
  };
}

export { STATUS_CONFIG };
