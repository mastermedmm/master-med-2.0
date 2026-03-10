
-- Insert juridico module permissions for admin (full access)
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize, tenant_id)
SELECT 'admin'::app_role, m.module_name, true, true, true, true, true, t.id
FROM (VALUES ('juridico.contratos'), ('juridico.rts')) AS m(module_name)
CROSS JOIN public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp 
  WHERE mp.role = 'admin' AND mp.module_name = m.module_name AND mp.tenant_id = t.id
);

-- Insert juridico module permissions for operador (no access by default)
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize, tenant_id)
SELECT 'operador'::app_role, m.module_name, false, false, false, false, false, t.id
FROM (VALUES ('juridico.contratos'), ('juridico.rts')) AS m(module_name)
CROSS JOIN public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp 
  WHERE mp.role = 'operador' AND mp.module_name = m.module_name AND mp.tenant_id = t.id
);

-- Insert juridico module permissions for financeiro (no access by default)
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize, tenant_id)
SELECT 'financeiro'::app_role, m.module_name, false, false, false, false, false, t.id
FROM (VALUES ('juridico.contratos'), ('juridico.rts')) AS m(module_name)
CROSS JOIN public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp 
  WHERE mp.role = 'financeiro' AND mp.module_name = m.module_name AND mp.tenant_id = t.id
);

-- Insert permissions for new 'juridico' role: ONLY juridico modules with full access
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize, tenant_id)
SELECT 'juridico'::app_role, m.module_name, true, true, true, true, false, t.id
FROM (VALUES ('juridico.contratos'), ('juridico.rts')) AS m(module_name)
CROSS JOIN public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp 
  WHERE mp.role = 'juridico' AND mp.module_name = m.module_name AND mp.tenant_id = t.id
);

-- Insert all OTHER modules for 'juridico' role with NO access
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize, tenant_id)
SELECT 'juridico'::app_role, m.module_name, false, false, false, false, false, t.id
FROM (VALUES 
  ('dashboard'), ('import'), ('allocation'), ('payables'), ('expenses'),
  ('doctors'), ('hospitals'), ('issuers'), ('banks'), ('statements'),
  ('reconciliation'), ('adjustments'), ('cashflow'), ('users'), ('permissions'), ('settings'), ('audit_logs'),
  ('nfse.dashboard'), ('nfse.emitir'), ('nfse.visualizar'), ('nfse.rejeicoes'),
  ('nfse.eventos'), ('nfse.sincronizacao'), ('nfse.documentos'), ('nfse.configuracoes'), ('nfse.reprocessar')
) AS m(module_name)
CROSS JOIN public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp 
  WHERE mp.role = 'juridico' AND mp.module_name = m.module_name AND mp.tenant_id = t.id
);
