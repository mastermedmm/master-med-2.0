
-- Drop existing tenant-based RLS policies on juridico_profissionais
DROP POLICY IF EXISTS "Tenant users can manage juridico_profissionais" ON public.juridico_profissionais;
DROP POLICY IF EXISTS "Tenant users can view juridico_profissionais" ON public.juridico_profissionais;

-- Drop existing tenant-based RLS policies on juridico_empresas
DROP POLICY IF EXISTS "Tenant users can manage juridico_empresas" ON public.juridico_empresas;
DROP POLICY IF EXISTS "Tenant users can view juridico_empresas" ON public.juridico_empresas;

-- Create new policies allowing all authenticated users
CREATE POLICY "Authenticated users can manage juridico_profissionais"
ON public.juridico_profissionais FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view juridico_profissionais"
ON public.juridico_profissionais FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage juridico_empresas"
ON public.juridico_empresas FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view juridico_empresas"
ON public.juridico_empresas FOR SELECT TO authenticated
USING (true);
