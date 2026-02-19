-- Insert default permissions for expenses module for all roles
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize)
VALUES 
  ('admin', 'expenses', true, true, true, true, true),
  ('operador', 'expenses', false, true, false, false, false),
  ('financeiro', 'expenses', true, true, true, true, false)
ON CONFLICT DO NOTHING;

-- Also add basic permissions for financeiro on other relevant modules
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize)
VALUES 
  ('financeiro', 'dashboard', false, true, false, false, false),
  ('financeiro', 'payables', true, true, true, false, false),
  ('financeiro', 'banks', false, true, false, false, false),
  ('financeiro', 'doctors', false, true, false, false, false),
  ('financeiro', 'hospitals', false, true, false, false, false)
ON CONFLICT DO NOTHING;