-- Permitir que vínculos RT usem apenas os cadastros do módulo Jurídico
ALTER TABLE public.vinculos_rt
  ALTER COLUMN profissional_id DROP NOT NULL,
  ALTER COLUMN empresa_id DROP NOT NULL;

-- Ajustar unicidade para funcionar tanto com registros legados quanto com os novos campos do Jurídico
DROP INDEX IF EXISTS public.idx_vinculos_rt_unique;

CREATE UNIQUE INDEX idx_vinculos_rt_unique
ON public.vinculos_rt (
  COALESCE(juridico_profissional_id, profissional_id),
  COALESCE(juridico_empresa_id, empresa_id),
  tenant_id
)
WHERE status = 'ativo'::public.rt_status
  AND COALESCE(juridico_profissional_id, profissional_id) IS NOT NULL
  AND COALESCE(juridico_empresa_id, empresa_id) IS NOT NULL
  AND tenant_id IS NOT NULL;

-- Índices para os novos relacionamentos do módulo Jurídico
CREATE INDEX IF NOT EXISTS idx_vinculos_rt_juridico_profissional
  ON public.vinculos_rt (juridico_profissional_id);

CREATE INDEX IF NOT EXISTS idx_vinculos_rt_juridico_empresa
  ON public.vinculos_rt (juridico_empresa_id);