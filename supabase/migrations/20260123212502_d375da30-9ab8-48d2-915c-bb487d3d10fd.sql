-- Insert default permissions for 'issuers' module for existing tenants
INSERT INTO public.module_permissions 
  (role, module_name, can_create, can_read, can_update, can_delete, can_customize, tenant_id)
SELECT 
  role,
  'issuers',
  CASE WHEN role = 'admin' THEN true ELSE false END,
  true,
  CASE WHEN role = 'admin' THEN true ELSE false END,
  CASE WHEN role = 'admin' THEN true ELSE false END,
  CASE WHEN role = 'admin' THEN true ELSE false END,
  tenant_id
FROM (
  SELECT DISTINCT role, tenant_id 
  FROM public.module_permissions
  WHERE tenant_id IS NOT NULL
) existing_roles
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp 
  WHERE mp.role = existing_roles.role 
  AND mp.tenant_id = existing_roles.tenant_id 
  AND mp.module_name = 'issuers'
);