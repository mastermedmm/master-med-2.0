
-- Insert NFSE permissions for admin role across all tenants
INSERT INTO public.module_permissions (role, module_name, tenant_id, can_create, can_read, can_update, can_delete, can_customize)
SELECT 
  'admin'::app_role,
  module_name,
  t.id,
  true, true, true, true, true
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('nfse.dashboard'),
    ('nfse.emitir'),
    ('nfse.visualizar'),
    ('nfse.rejeicoes'),
    ('nfse.eventos'),
    ('nfse.sincronizacao'),
    ('nfse.documentos'),
    ('nfse.configuracoes'),
    ('nfse.reprocessar')
) AS modules(module_name)
ON CONFLICT DO NOTHING;

-- Insert NFSE permissions for operador role (all disabled initially)
INSERT INTO public.module_permissions (role, module_name, tenant_id, can_create, can_read, can_update, can_delete, can_customize)
SELECT 
  'operador'::app_role,
  module_name,
  t.id,
  false, false, false, false, false
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('nfse.dashboard'),
    ('nfse.emitir'),
    ('nfse.visualizar'),
    ('nfse.rejeicoes'),
    ('nfse.eventos'),
    ('nfse.sincronizacao'),
    ('nfse.documentos'),
    ('nfse.configuracoes'),
    ('nfse.reprocessar')
) AS modules(module_name)
ON CONFLICT DO NOTHING;

-- Insert NFSE permissions for financeiro role (all disabled initially)
INSERT INTO public.module_permissions (role, module_name, tenant_id, can_create, can_read, can_update, can_delete, can_customize)
SELECT 
  'financeiro'::app_role,
  module_name,
  t.id,
  false, false, false, false, false
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('nfse.dashboard'),
    ('nfse.emitir'),
    ('nfse.visualizar'),
    ('nfse.rejeicoes'),
    ('nfse.eventos'),
    ('nfse.sincronizacao'),
    ('nfse.documentos'),
    ('nfse.configuracoes'),
    ('nfse.reprocessar')
) AS modules(module_name)
ON CONFLICT DO NOTHING;
