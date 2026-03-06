
-- 1. Create tomadores_nfse table
CREATE TABLE public.tomadores_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  nome text NOT NULL,
  cpf_cnpj text NOT NULL,
  inscricao_municipal text,
  email text,
  telefone text,
  logradouro text,
  numero text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tomadores_nfse_tenant_id ON public.tomadores_nfse(tenant_id);
CREATE INDEX idx_tomadores_nfse_cpf_cnpj ON public.tomadores_nfse(cpf_cnpj);
CREATE INDEX idx_tomadores_nfse_nome ON public.tomadores_nfse(nome);

ALTER TABLE public.tomadores_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view tomadores_nfse"
  ON public.tomadores_nfse FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage tomadores_nfse"
  ON public.tomadores_nfse FOR ALL TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_tomadores_nfse_updated_at
  BEFORE UPDATE ON public.tomadores_nfse
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Update notas_fiscais FK from hospitals to tomadores_nfse
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_tomador_id_fkey;
ALTER TABLE public.notas_fiscais 
  ADD CONSTRAINT notas_fiscais_tomador_id_fkey 
  FOREIGN KEY (tomador_id) REFERENCES public.tomadores_nfse(id);
