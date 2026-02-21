CREATE TABLE public.licensees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  cpf text NOT NULL,
  commission numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licensees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view licensees" ON public.licensees
  FOR SELECT USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage licensees" ON public.licensees
  FOR ALL USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));