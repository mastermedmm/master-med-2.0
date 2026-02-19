-- Adicionar coluna para tenant ativo na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_tenant_id uuid REFERENCES public.tenants(id);

-- Função para buscar todos os tenants acessíveis pelo usuário
CREATE OR REPLACE FUNCTION public.get_user_accessible_tenants(_user_id uuid)
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  user_role app_role
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    ur.role as user_role
  FROM public.user_roles ur
  INNER JOIN public.tenants t ON ur.tenant_id = t.id
  WHERE ur.user_id = _user_id
    AND t.status = 'active'
  ORDER BY t.name
$$;

-- Atualizar função get_user_tenant_id para considerar active_tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_tenant_id FROM public.profiles WHERE user_id = _user_id),
    (SELECT tenant_id FROM public.profiles WHERE user_id = _user_id),
    (SELECT tenant_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1)
  )
$$;