
-- Table for NFSE integration configurations per tenant
CREATE TABLE public.configuracoes_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Certificado digital
  certificado_base64 text,
  certificado_senha text,
  certificado_validade date,
  certificado_nome text,
  -- Ambiente
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  -- Endpoint
  endpoint_api text,
  -- Município emissor
  municipio_codigo text,
  municipio_nome text,
  municipio_uf text,
  -- Inscricao municipal do prestador
  inscricao_municipal text,
  -- CNPJ do prestador
  prestador_cnpj text,
  prestador_razao_social text,
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(tenant_id)
);

-- RLS
ALTER TABLE public.configuracoes_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage configuracoes_nfse"
  ON public.configuracoes_nfse
  FOR ALL
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant users can view configuracoes_nfse"
  ON public.configuracoes_nfse
  FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Index
CREATE INDEX idx_configuracoes_nfse_tenant ON public.configuracoes_nfse(tenant_id);

-- Updated_at trigger
CREATE TRIGGER update_configuracoes_nfse_updated_at
  BEFORE UPDATE ON public.configuracoes_nfse
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
