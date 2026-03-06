
-- Add issuer_id column and remove tenant-only uniqueness
ALTER TABLE public.configuracoes_nfse
  ADD COLUMN issuer_id uuid REFERENCES public.issuers(id) ON DELETE CASCADE;

-- Drop old unique constraint (tenant_id only)
ALTER TABLE public.configuracoes_nfse
  DROP CONSTRAINT IF EXISTS configuracoes_nfse_tenant_id_key;

-- New unique: one config per issuer per tenant
ALTER TABLE public.configuracoes_nfse
  ADD CONSTRAINT configuracoes_nfse_tenant_issuer_unique UNIQUE(tenant_id, issuer_id);

-- Index on issuer
CREATE INDEX idx_configuracoes_nfse_issuer ON public.configuracoes_nfse(issuer_id);
