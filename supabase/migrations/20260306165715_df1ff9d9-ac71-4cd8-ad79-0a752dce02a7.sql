
-- Add issuer_id to notas_fiscais
ALTER TABLE public.notas_fiscais ADD COLUMN issuer_id uuid REFERENCES public.issuers(id);
CREATE INDEX idx_notas_fiscais_issuer ON public.notas_fiscais(issuer_id);

-- Add issuer_id to documentos_nfse
ALTER TABLE public.documentos_nfse ADD COLUMN issuer_id uuid REFERENCES public.issuers(id);
CREATE INDEX idx_documentos_nfse_issuer ON public.documentos_nfse(issuer_id);
