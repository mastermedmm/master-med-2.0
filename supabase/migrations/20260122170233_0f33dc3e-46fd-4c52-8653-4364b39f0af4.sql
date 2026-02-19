
-- =============================================
-- FASE 1.1: Criar tabela de Tenants
-- =============================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  document TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FASE 1.2: Criar tabela de Super Admins
-- =============================================
CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FASE 1.3: Criar tabela de Logs de Impersonação
-- =============================================
CREATE TABLE public.tenant_impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID REFERENCES public.super_admins(id) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para logs
ALTER TABLE public.tenant_impersonation_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FASE 1.4: Adicionar tenant_id às tabelas existentes PRIMEIRO
-- =============================================

-- Adicionar coluna tenant_id (nullable inicialmente para migração)
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.doctors ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.hospitals ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.banks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoices ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoice_allocations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.accounts_payable ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.payments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.expenses ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.expense_categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.module_permissions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.system_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.column_preferences ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Criar índices para tenant_id
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_doctors_tenant_id ON public.doctors(tenant_id);
CREATE INDEX idx_hospitals_tenant_id ON public.hospitals(tenant_id);
CREATE INDEX idx_banks_tenant_id ON public.banks(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_invoice_allocations_tenant_id ON public.invoice_allocations(tenant_id);
CREATE INDEX idx_accounts_payable_tenant_id ON public.accounts_payable(tenant_id);
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_expenses_tenant_id ON public.expenses(tenant_id);
CREATE INDEX idx_expense_categories_tenant_id ON public.expense_categories(tenant_id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_module_permissions_tenant_id ON public.module_permissions(tenant_id);
CREATE INDEX idx_system_settings_tenant_id ON public.system_settings(tenant_id);
CREATE INDEX idx_column_preferences_tenant_id ON public.column_preferences(tenant_id);

-- =============================================
-- FASE 1.5: Funções Auxiliares (DEPOIS de adicionar colunas)
-- =============================================

-- Função para verificar se é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
  )
$$;

-- Função para obter tenant_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id
$$;

-- =============================================
-- RLS Policies para tabelas novas
-- =============================================

-- Super admins podem gerenciar tenants
CREATE POLICY "Super admins can manage tenants"
ON public.tenants FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Usuários podem ver seu próprio tenant
CREATE POLICY "Users can view own tenant"
ON public.tenants FOR SELECT
USING (
  id = public.get_user_tenant_id(auth.uid())
);

-- Super admins podem gerenciar super_admins
CREATE POLICY "Super admins can manage super_admins"
ON public.super_admins FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admins podem ver e criar logs
CREATE POLICY "Super admins can manage impersonation logs"
ON public.tenant_impersonation_logs FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
