
-- Create attachments table for RT vinculos
CREATE TABLE public.anexos_vinculos_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_rt_id UUID NOT NULL REFERENCES public.vinculos_rt(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  caminho_arquivo TEXT NOT NULL,
  tamanho_bytes INTEGER,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.anexos_vinculos_rt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view anexos_vinculos_rt"
  ON public.anexos_vinculos_rt
  FOR SELECT
  TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can insert anexos_vinculos_rt"
  ON public.anexos_vinculos_rt
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can delete anexos_vinculos_rt"
  ON public.anexos_vinculos_rt
  FOR DELETE
  TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE INDEX idx_anexos_vinculos_rt_vinculo ON public.anexos_vinculos_rt(vinculo_rt_id);

-- Create storage bucket for RT attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('rt-anexos', 'rt-anexos', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload rt-anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rt-anexos');

CREATE POLICY "Authenticated users can read rt-anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rt-anexos');

CREATE POLICY "Authenticated users can delete rt-anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rt-anexos');

-- Add 'renovacao' to RT history event types
-- (no enum needed, tipo_evento is TEXT)
