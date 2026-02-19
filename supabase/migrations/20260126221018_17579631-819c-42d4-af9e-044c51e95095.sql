-- Insert new module permissions for all existing tenants and roles
-- Get all distinct tenant_ids and add new modules for each role

INSERT INTO module_permissions (tenant_id, role, module_name, can_create, can_read, can_update, can_delete, can_customize)
SELECT DISTINCT 
  mp.tenant_id, 
  mp.role,
  new_module.module_name,
  true, true, true, true, 
  CASE WHEN mp.role = 'admin' THEN true ELSE false END
FROM module_permissions mp
CROSS JOIN (
  VALUES 
    ('statements'),
    ('reconciliation'),
    ('adjustments'),
    ('cashflow')
) AS new_module(module_name)
WHERE NOT EXISTS (
  SELECT 1 FROM module_permissions existing 
  WHERE existing.tenant_id = mp.tenant_id 
    AND existing.role = mp.role 
    AND existing.module_name = new_module.module_name
)
GROUP BY mp.tenant_id, mp.role, new_module.module_name;