
-- 1) Create juridico_profissionais table
CREATE TABLE public.juridico_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  registro_conselho text,
  tipo_conselho text,
  uf_conselho text,
  telefone text,
  email text,
  observacoes text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Create juridico_empresas table
CREATE TABLE public.juridico_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  cidade text,
  uf text,
  observacoes text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Enable RLS
ALTER TABLE public.juridico_profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juridico_empresas ENABLE ROW LEVEL SECURITY;

-- 4) RLS policies for juridico_profissionais
CREATE POLICY "Tenant users can view juridico_profissionais"
  ON public.juridico_profissionais FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage juridico_profissionais"
  ON public.juridico_profissionais FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- 5) RLS policies for juridico_empresas
CREATE POLICY "Tenant users can view juridico_empresas"
  ON public.juridico_empresas FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage juridico_empresas"
  ON public.juridico_empresas FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- 6) Add new nullable FK columns to vinculos_rt
ALTER TABLE public.vinculos_rt 
  ADD COLUMN juridico_profissional_id uuid REFERENCES public.juridico_profissionais(id),
  ADD COLUMN juridico_empresa_id uuid REFERENCES public.juridico_empresas(id);

-- 7) Add new nullable FK column to contratos
ALTER TABLE public.contratos 
  ADD COLUMN juridico_empresa_id uuid REFERENCES public.juridico_empresas(id);

-- 8) Migrate existing profissionais from doctors used in vinculos_rt
INSERT INTO public.juridico_profissionais (id, nome, cpf, registro_conselho, tipo_conselho, telefone, tenant_id)
SELECT DISTINCT d.id, d.name, d.cpf, d.crm, 'CRM', d.phone, d.tenant_id
FROM public.doctors d
INNER JOIN public.vinculos_rt vr ON vr.profissional_id = d.id;

-- 9) Migrate existing empresas from issuers used in vinculos_rt or contratos
INSERT INTO public.juridico_empresas (id, nome, cnpj, cidade, uf, tenant_id)
SELECT DISTINCT i.id, i.name, i.cnpj, i.city, i.state, i.tenant_id
FROM public.issuers i
WHERE i.id IN (
  SELECT empresa_id FROM public.vinculos_rt
  UNION
  SELECT issuer_id FROM public.contratos
);

-- 10) Update vinculos_rt to point to new tables
UPDATE public.vinculos_rt SET
  juridico_profissional_id = profissional_id,
  juridico_empresa_id = empresa_id;

-- 11) Update contratos to point to new tables
UPDATE public.contratos SET
  juridico_empresa_id = issuer_id;

-- 12) Updated_at triggers
CREATE TRIGGER update_juridico_profissionais_updated_at
  BEFORE UPDATE ON public.juridico_profissionais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_juridico_empresas_updated_at
  BEFORE UPDATE ON public.juridico_empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13) Provision permissions for juridico.profissionais and juridico.empresas
INSERT INTO public.module_permissions (tenant_id, role, module_name, can_read, can_create, can_update, can_delete, can_customize)
SELECT tenant_id, role, 'juridico.profissionais', can_read, can_create, can_update, can_delete, can_customize
FROM public.module_permissions
WHERE module_name = 'juridico.contratos';

INSERT INTO public.module_permissions (tenant_id, role, module_name, can_read, can_create, can_update, can_delete, can_customize)
SELECT tenant_id, role, 'juridico.empresas', can_read, can_create, can_update, can_delete, can_customize
FROM public.module_permissions
WHERE module_name = 'juridico.contratos';
