-- Tabela de logs de sincronização SIEG
CREATE TABLE public.sieg_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sync_started_at timestamptz NOT NULL DEFAULT now(),
  sync_completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  total_xmls_found int DEFAULT 0,
  xmls_imported int DEFAULT 0,
  xmls_skipped int DEFAULT 0,
  xmls_updated int DEFAULT 0,
  xmls_failed int DEFAULT 0,
  error_message text,
  error_details jsonb,
  filter_cnpj_emit text,
  filter_date_start date,
  filter_date_end date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_sieg_sync_logs_tenant ON public.sieg_sync_logs(tenant_id);
CREATE INDEX idx_sieg_sync_logs_status ON public.sieg_sync_logs(status);
CREATE INDEX idx_sieg_sync_logs_started_at ON public.sieg_sync_logs(sync_started_at DESC);

-- Constraint único para evitar syncs simultâneos por tenant
CREATE UNIQUE INDEX idx_sieg_sync_running 
  ON public.sieg_sync_logs (tenant_id) 
  WHERE status = 'running';

-- Habilitar RLS
ALTER TABLE public.sieg_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant users can view sync logs"
  ON public.sieg_sync_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage sync logs"
  ON public.sieg_sync_logs FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));