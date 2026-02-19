
-- =============================================
-- FASE 5: Migração de Dados Existentes
-- =============================================

-- Criar tenant padrão para dados existentes
INSERT INTO public.tenants (name, slug, email, plan, status)
VALUES ('Empresa Principal', 'principal', 'admin@empresa.com', 'enterprise', 'active');

-- Atualizar todas as tabelas com o tenant_id do tenant padrão
UPDATE public.profiles SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.doctors SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.hospitals SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.banks SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.invoices SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.invoice_allocations SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.accounts_payable SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.payments SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.expenses SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.expense_categories SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.user_roles SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.module_permissions SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.system_settings SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;
UPDATE public.column_preferences SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'principal') WHERE tenant_id IS NULL;

-- =============================================
-- Remover políticas RLS antigas (com USING true)
-- =============================================

-- doctors
DROP POLICY IF EXISTS "Authenticated users can manage doctors" ON public.doctors;
DROP POLICY IF EXISTS "Authenticated users can view doctors" ON public.doctors;

-- hospitals
DROP POLICY IF EXISTS "Authenticated users can manage hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Authenticated users can view hospitals" ON public.hospitals;

-- banks
DROP POLICY IF EXISTS "Authenticated users can manage banks" ON public.banks;
DROP POLICY IF EXISTS "Authenticated users can view banks" ON public.banks;

-- invoices
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;

-- invoice_allocations
DROP POLICY IF EXISTS "Authenticated users can manage allocations" ON public.invoice_allocations;
DROP POLICY IF EXISTS "Authenticated users can view allocations" ON public.invoice_allocations;

-- accounts_payable
DROP POLICY IF EXISTS "Authenticated users can manage accounts payable" ON public.accounts_payable;
DROP POLICY IF EXISTS "Authenticated users can view accounts payable" ON public.accounts_payable;

-- payments
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

-- expenses
DROP POLICY IF EXISTS "Authenticated users can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;

-- expense_categories
DROP POLICY IF EXISTS "Authenticated users can manage expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Authenticated users can view expense categories" ON public.expense_categories;

-- =============================================
-- Criar novas políticas RLS com isolamento por tenant
-- =============================================

-- DOCTORS
CREATE POLICY "Tenant users can view doctors"
ON public.doctors FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage doctors"
ON public.doctors FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- HOSPITALS
CREATE POLICY "Tenant users can view hospitals"
ON public.hospitals FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage hospitals"
ON public.hospitals FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- BANKS
CREATE POLICY "Tenant users can view banks"
ON public.banks FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage banks"
ON public.banks FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- INVOICES
CREATE POLICY "Tenant users can view invoices"
ON public.invoices FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage invoices"
ON public.invoices FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- INVOICE_ALLOCATIONS
CREATE POLICY "Tenant users can view allocations"
ON public.invoice_allocations FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage allocations"
ON public.invoice_allocations FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- ACCOUNTS_PAYABLE
CREATE POLICY "Tenant users can view accounts payable"
ON public.accounts_payable FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage accounts payable"
ON public.accounts_payable FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- PAYMENTS
CREATE POLICY "Tenant users can view payments"
ON public.payments FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage payments"
ON public.payments FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- EXPENSES
CREATE POLICY "Tenant users can view expenses"
ON public.expenses FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage expenses"
ON public.expenses FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- EXPENSE_CATEGORIES
CREATE POLICY "Tenant users can view expense categories"
ON public.expense_categories FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage expense categories"
ON public.expense_categories FOR ALL
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- USER_ROLES (atualizar para incluir tenant)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Tenant admins can manage roles"
ON public.user_roles FOR ALL
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- SYSTEM_SETTINGS (tenant-scoped)
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.system_settings;

CREATE POLICY "Tenant admins can manage settings"
ON public.system_settings FOR ALL
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can view settings"
ON public.system_settings FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- COLUMN_PREFERENCES (tenant-scoped)
DROP POLICY IF EXISTS "Admins can manage column preferences" ON public.column_preferences;
DROP POLICY IF EXISTS "Everyone can view column preferences" ON public.column_preferences;

CREATE POLICY "Tenant admins can manage column preferences"
ON public.column_preferences FOR ALL
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can view column preferences"
ON public.column_preferences FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- MODULE_PERMISSIONS (tenant-scoped)
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.module_permissions;
DROP POLICY IF EXISTS "Users can view permissions" ON public.module_permissions;

CREATE POLICY "Tenant admins can manage permissions"
ON public.module_permissions FOR ALL
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can view permissions"
ON public.module_permissions FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- PROFILES (atualizar para incluir tenant)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (
  user_id = auth.uid()
  OR (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin(auth.uid())
);
