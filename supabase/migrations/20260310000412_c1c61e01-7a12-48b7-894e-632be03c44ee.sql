
-- Drop enum if partially created
DROP TYPE IF EXISTS public.rt_status;

-- Recreate enum
CREATE TYPE public.rt_status AS ENUM ('ativo', 'inativo', 'vencido', 'cancelado');

-- Create table
CREATE TABLE public.vinculos_rt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.issuers(id) ON DELETE CASCADE,
  conselho_pj TEXT,
  uf_conselho_pj TEXT,
  registro_pj TEXT,
  data_inicio_responsabilidade DATE,
  data_validade DATE,
  login_portal_conselho TEXT,
  senha_portal_conselho TEXT,
  observacoes TEXT,
  status rt_status NOT NULL DEFAULT 'ativo',
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_vinculos_rt_tenant ON public.vinculos_rt(tenant_id);
CREATE INDEX idx_vinculos_rt_profissional ON public.vinculos_rt(profissional_id);
CREATE INDEX idx_vinculos_rt_empresa ON public.vinculos_rt(empresa_id);
CREATE UNIQUE INDEX idx_vinculos_rt_unique ON public.vinculos_rt(profissional_id, empresa_id, tenant_id) WHERE status = 'ativo'::rt_status;

-- Trigger
CREATE TRIGGER update_vinculos_rt_updated_at
  BEFORE UPDATE ON public.vinculos_rt
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.vinculos_rt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view vinculos_rt"
  ON public.vinculos_rt
  FOR SELECT
  TO public
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage vinculos_rt"
  ON public.vinculos_rt
  FOR ALL
  TO public
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));
