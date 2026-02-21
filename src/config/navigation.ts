import type { ComponentType } from "react";
import type { ModuleName } from "@/hooks/usePermissions";
import {
  Building2,
  CreditCard,
  FileUp,
  FileSpreadsheet,
  LayoutDashboard,
  Landmark,
  Link2,
  PieChart,
  Settings,
  Shield,
  UserCog,
  Users,
  FolderTree,
  Factory,
  Wallet,
  TrendingUp,
  Scale,
  Cloud,
  History,
  Handshake,
} from "lucide-react";
import { ROUTES } from "./routes";

export type AppNavItem = {
  label: string;
  to: string;
  icon?: ComponentType<{ className?: string }>;
  module?: ModuleName;
};

export const primaryNav: AppNavItem[] = [
  { label: "Dashboard", to: ROUTES.dashboard, icon: LayoutDashboard, module: "dashboard" },
  { label: "Integração SIEG", to: ROUTES.siegIntegration, icon: Cloud, module: "import" },
  { label: "Importar NF", to: ROUTES.import, icon: FileUp, module: "import" },
  { label: "Rateio", to: ROUTES.allocation, icon: PieChart, module: "allocation" },
  { label: "Lançamentos", to: ROUTES.payables, icon: CreditCard, module: "payables" },
];

export const financialNav: AppNavItem[] = [
  { label: "Importar Extrato", to: ROUTES.importStatement, icon: FileSpreadsheet, module: "statements" },
  { label: "Conciliar Despesas", to: ROUTES.reconcileTransactions, icon: Link2, module: "reconciliation" },
  { label: "Ajustes de Recebimento", to: ROUTES.receiptPaymentAdjustments, icon: Scale, module: "adjustments" },
  { label: "Fluxo de Caixa", to: ROUTES.cashFlow, icon: Wallet, module: "cashflow" },
  { label: "Fluxo Acumulado", to: ROUTES.accumulatedCashFlow, icon: TrendingUp, module: "cashflow" },
];

export const registrationNav: AppNavItem[] = [
  { label: "Médicos", to: ROUTES.doctors, icon: Users, module: "doctors" },
  { label: "Hospitais", to: ROUTES.hospitals, icon: Building2, module: "hospitals" },
  { label: "Emitentes", to: ROUTES.issuers, icon: Factory, module: "issuers" },
  { label: "Bancos", to: ROUTES.banks, icon: Landmark, module: "banks" },
  { label: "Plano de Contas", to: ROUTES.chartOfAccounts, icon: FolderTree, module: "expenses" },
  { label: "Licenciados", to: ROUTES.licensees, icon: Handshake, module: "doctors" },
];

export const adminNav: AppNavItem[] = [
  { label: "Usuários", to: ROUTES.users, icon: UserCog, module: "users" },
  { label: "Permissões", to: ROUTES.permissions, icon: Shield, module: "permissions" },
  { label: "Log de Eventos", to: ROUTES.auditLogs, icon: History, module: "audit_logs" },
  { label: "Configurações", to: ROUTES.settings, icon: Settings, module: "settings" },
];

export const topNav: AppNavItem[] = [...primaryNav, ...financialNav, ...registrationNav, ...adminNav];
