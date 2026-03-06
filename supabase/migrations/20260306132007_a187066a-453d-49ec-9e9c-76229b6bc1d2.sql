
-- Enum para status da NFSE
CREATE TYPE public.nfse_status AS ENUM (
  'rascunho',
  'fila_emissao',
  'enviado',
  'autorizado',
  'rejeitado',
  'cancelado',
  'substituido',
  'divergente'
);

-- Enum para tipo de evento NFSE
CREATE TYPE public.nfse_evento_tipo AS ENUM (
  'emissao',
  'autorizacao',
  'rejeicao',
  'cancelamento',
  'substituicao',
  'consulta',
  'reprocessamento',
  'envio_dps',
  'retorno_prefeitura'
);

-- Enum para tipo de documento NFSE
CREATE TYPE public.nfse_documento_tipo AS ENUM (
  'xml_nfse',
  'xml_dps',
  'xml_evento',
  'pdf_nfse',
  'pdf_danfse'
);

-- Enum para status de sincronização
CREATE TYPE public.nfse_job_status AS ENUM (
  'pendente',
  'executando',
  'concluido',
  'falha',
  'cancelado'
);

-- ============================================================
-- 1. notas_fiscais - Nota Fiscal de Serviço Eletrônica
-- ============================================================
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  numero_nfse text,
  chave_acesso text,
  numero_dps text,
  status nfse_status NOT NULL DEFAULT 'rascunho',
  valor_servico numeric NOT NULL DEFAULT 0,
  valor_deducoes numeric NOT NULL DEFAULT 0,
  valor_iss numeric NOT NULL DEFAULT 0,
  aliquota_iss numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  valor_pis numeric NOT NULL DEFAULT 0,
  valor_cofins numeric NOT NULL DEFAULT 0,
  valor_inss numeric NOT NULL DEFAULT 0,
  valor_ir numeric NOT NULL DEFAULT 0,
  valor_csll numeric NOT NULL DEFAULT 0,
  iss_retido boolean NOT NULL DEFAULT false,
  data_emissao date,
  data_autorizacao timestamptz,
  municipio_codigo text,
  municipio_nome text,
  tomador_id uuid REFERENCES public.hospitals(id),
  tomador_nome text,
  tomador_documento text,
  descricao_servico text,
  codigo_servico text,
  codigo_cnae text,
  xml_nfse text,
  motivo_rejeicao text,
  nfse_substituida_id uuid REFERENCES public.notas_fiscais(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for notas_fiscais
CREATE INDEX idx_notas_fiscais_tenant_id ON public.notas_fiscais(tenant_id);
CREATE INDEX idx_notas_fiscais_chave_acesso ON public.notas_fiscais(chave_acesso);
CREATE INDEX idx_notas_fiscais_status ON public.notas_fiscais(status);
CREATE INDEX idx_notas_fiscais_data_emissao ON public.notas_fiscais(data_emissao);
CREATE INDEX idx_notas_fiscais_tomador_id ON public.notas_fiscais(tomador_id);
CREATE INDEX idx_notas_fiscais_numero_nfse ON public.notas_fiscais(numero_nfse);

-- RLS
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view notas_fiscais"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage notas_fiscais"
  ON public.notas_fiscais FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- ============================================================
-- 2. dps_enviadas - Declaração de Prestação de Serviço
-- ============================================================
CREATE TABLE public.dps_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE CASCADE NOT NULL,
  numero_lote text,
  protocolo text,
  xml_envio text,
  xml_retorno text,
  status text NOT NULL DEFAULT 'pendente',
  codigo_retorno text,
  mensagem_retorno text,
  enviado_em timestamptz,
  retorno_em timestamptz,
  tentativas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dps_enviadas_tenant_id ON public.dps_enviadas(tenant_id);
CREATE INDEX idx_dps_enviadas_nota_fiscal_id ON public.dps_enviadas(nota_fiscal_id);
CREATE INDEX idx_dps_enviadas_status ON public.dps_enviadas(status);

ALTER TABLE public.dps_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view dps_enviadas"
  ON public.dps_enviadas FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage dps_enviadas"
  ON public.dps_enviadas FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- ============================================================
-- 3. eventos_nfse - Eventos/Histórico da Nota
-- ============================================================
CREATE TABLE public.eventos_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE CASCADE NOT NULL,
  tipo nfse_evento_tipo NOT NULL,
  descricao text,
  dados jsonb,
  codigo_retorno text,
  mensagem text,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_nfse_tenant_id ON public.eventos_nfse(tenant_id);
CREATE INDEX idx_eventos_nfse_nota_fiscal_id ON public.eventos_nfse(nota_fiscal_id);
CREATE INDEX idx_eventos_nfse_tipo ON public.eventos_nfse(tipo);
CREATE INDEX idx_eventos_nfse_created_at ON public.eventos_nfse(created_at);

ALTER TABLE public.eventos_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view eventos_nfse"
  ON public.eventos_nfse FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage eventos_nfse"
  ON public.eventos_nfse FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- ============================================================
-- 4. documentos_nfse - XMLs e PDFs armazenados
-- ============================================================
CREATE TABLE public.documentos_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE CASCADE NOT NULL,
  tipo nfse_documento_tipo NOT NULL,
  nome_arquivo text NOT NULL,
  url text,
  storage_path text,
  conteudo text,
  hash text,
  tamanho_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_nfse_tenant_id ON public.documentos_nfse(tenant_id);
CREATE INDEX idx_documentos_nfse_nota_fiscal_id ON public.documentos_nfse(nota_fiscal_id);
CREATE INDEX idx_documentos_nfse_tipo ON public.documentos_nfse(tipo);

ALTER TABLE public.documentos_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view documentos_nfse"
  ON public.documentos_nfse FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage documentos_nfse"
  ON public.documentos_nfse FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- ============================================================
-- 5. logs_integracao_nfse - Logs de comunicação com prefeitura
-- ============================================================
CREATE TABLE public.logs_integracao_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  endpoint text,
  request_payload text,
  response_payload text,
  http_status integer,
  sucesso boolean NOT NULL DEFAULT false,
  erro_mensagem text,
  duracao_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_integracao_nfse_tenant_id ON public.logs_integracao_nfse(tenant_id);
CREATE INDEX idx_logs_integracao_nfse_nota_fiscal_id ON public.logs_integracao_nfse(nota_fiscal_id);
CREATE INDEX idx_logs_integracao_nfse_created_at ON public.logs_integracao_nfse(created_at);
CREATE INDEX idx_logs_integracao_nfse_operacao ON public.logs_integracao_nfse(operacao);

ALTER TABLE public.logs_integracao_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view logs_integracao_nfse"
  ON public.logs_integracao_nfse FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage logs_integracao_nfse"
  ON public.logs_integracao_nfse FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- ============================================================
-- 6. jobs_sincronizacao_nfse - Filas de processamento
-- ============================================================
CREATE TABLE public.jobs_sincronizacao_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  tipo text NOT NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  status nfse_job_status NOT NULL DEFAULT 'pendente',
  prioridade integer NOT NULL DEFAULT 0,
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 3,
  proximo_retry_em timestamptz,
  erro_ultima_tentativa text,
  dados jsonb,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_sincronizacao_nfse_tenant_id ON public.jobs_sincronizacao_nfse(tenant_id);
CREATE INDEX idx_jobs_sincronizacao_nfse_status ON public.jobs_sincronizacao_nfse(status);
CREATE INDEX idx_jobs_sincronizacao_nfse_nota_fiscal_id ON public.jobs_sincronizacao_nfse(nota_fiscal_id);
CREATE INDEX idx_jobs_sincronizacao_nfse_proximo_retry ON public.jobs_sincronizacao_nfse(proximo_retry_em) WHERE status = 'pendente';

ALTER TABLE public.jobs_sincronizacao_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view jobs_sincronizacao_nfse"
  ON public.jobs_sincronizacao_nfse FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage jobs_sincronizacao_nfse"
  ON public.jobs_sincronizacao_nfse FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger updated_at para tabelas que possuem o campo
CREATE TRIGGER update_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dps_enviadas_updated_at
  BEFORE UPDATE ON public.dps_enviadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_sincronizacao_nfse_updated_at
  BEFORE UPDATE ON public.jobs_sincronizacao_nfse
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
