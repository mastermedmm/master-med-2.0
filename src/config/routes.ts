// Rotas centralizadas - altere aqui para mudar em todo o sistema
export const ROUTES = {
  auth: '/auth',
  dashboard: '/painel',
  import: '/importar',
  siegIntegration: '/integracao-sieg',
  importStatement: '/importar-extrato',
  reconcileTransactions: '/conciliar-despesas',
  receiptPaymentAdjustments: '/ajustes-recebimento-pagamento',
  allocation: '/rateio',
  allocationDetail: (invoiceId: string) => `/rateio/${invoiceId}`,
  payables: '/lancamentos',
  payableDetail: (payableId: string) => `/lancamentos/${payableId}`,
  cashFlow: '/fluxo-caixa',
  accumulatedCashFlow: '/fluxo-acumulado',
  expenses: '/despesas',
  expenseCategories: '/categorias-despesas',
  chartOfAccounts: '/plano-contas',
  licensees: '/licenciados',
  auditLogs: '/log-eventos',
  doctors: '/medicos',
  hospitals: '/hospitais',
  issuers: '/emitentes',
  banks: '/bancos',
  bankStatement: (bankId: string) => `/extrato-bancario/${bankId}`,
  users: '/usuarios',
  permissions: '/permissoes',
  settings: '/configuracoes',
  
  // Portal do Médico
  doctorPortal: {
    root: '/portal-medico',
    login: '/portal-medico/login',
    dashboard: '/portal-medico/painel',
    changePassword: '/portal-medico/alterar-senha',
  },
  
  // Portal do Licenciado
  licenseePortal: {
    root: '/portal-licenciado',
    login: '/portal-licenciado/login',
    dashboard: '/portal-licenciado/painel',
    changePassword: '/portal-licenciado/alterar-senha',
  },
  
  // Super Admin
  superAdmin: {
    root: '/super-admin',
    login: '/super-admin/login',
    dashboard: '/super-admin',
    tenants: '/super-admin/tenants',
    tenantNew: '/super-admin/tenants/new',
    tenantEdit: (id: string) => `/super-admin/tenants/${id}/edit`,
  },
  
  // Legacy redirects - rotas antigas que devem redirecionar para as novas
  legacy: {
    dashboard: '/dashboard',
    import: '/import',
    allocation: '/allocation',
    payables: '/payables',
    receipts: '/receipts',
    expenses: '/expenses',
    expenseCategories: '/expense-categories',
    doctors: '/doctors',
    hospitals: '/hospitals',
    banks: '/banks',
    bankStatement: '/bank-statement',
    users: '/users',
    permissions: '/permissions',
    settings: '/settings',
    doctorPortalDashboard: '/doctor-portal/dashboard',
    doctorPortalLogin: '/doctor-portal/login',
    doctorPortalChangePassword: '/doctor-portal/change-password',
    reconcileTransactions: '/conciliar-transacoes',
  },
} as const;
