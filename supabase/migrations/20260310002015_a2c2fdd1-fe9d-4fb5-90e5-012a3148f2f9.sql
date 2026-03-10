
-- Create history table for RT vinculos
CREATE TABLE public.historico_vinculos_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_rt_id UUID NOT NULL REFERENCES public.vinculos_rt(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  descricao TEXT NOT NULL,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

-- Enable RLS
ALTER TABLE public.historico_vinculos_rt ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant users can view historico_vinculos_rt"
  ON public.historico_vinculos_rt
  FOR SELECT
  TO authenticated
  USING (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant users can insert historico_vinculos_rt"
  ON public.historico_vinculos_rt
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
  );

-- Index for fast lookups
CREATE INDEX idx_historico_vinculos_rt_vinculo ON public.historico_vinculos_rt(vinculo_rt_id);
CREATE INDEX idx_historico_vinculos_rt_tenant ON public.historico_vinculos_rt(tenant_id);
