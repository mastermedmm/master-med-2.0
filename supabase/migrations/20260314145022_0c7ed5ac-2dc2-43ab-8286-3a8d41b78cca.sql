CREATE TABLE public.juridico_tipos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.juridico_tipos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view juridico_tipos_contrato"
  ON public.juridico_tipos_contrato FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage juridico_tipos_contrato"
  ON public.juridico_tipos_contrato FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_juridico_tipos_contrato_updated_at
  BEFORE UPDATE ON public.juridico_tipos_contrato
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();