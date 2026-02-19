-- Criar tabela de grupos de despesas
CREATE TABLE public.expense_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  order_index integer NOT NULL DEFAULT 0,
  tenant_id uuid REFERENCES public.tenants(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar colunas em expense_categories
ALTER TABLE public.expense_categories 
ADD COLUMN group_id uuid REFERENCES public.expense_groups(id),
ADD COLUMN order_index integer NOT NULL DEFAULT 0;

-- Habilitar RLS para expense_groups
ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;

-- Política para visualização
CREATE POLICY "Tenant users can view expense groups" 
ON public.expense_groups 
FOR SELECT 
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Política para gerenciamento
CREATE POLICY "Tenant users can manage expense groups" 
ON public.expense_groups 
FOR ALL 
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_expense_groups_updated_at
BEFORE UPDATE ON public.expense_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();