-- Create module_permissions table
CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_name text NOT NULL,
  can_create boolean NOT NULL DEFAULT false,
  can_read boolean NOT NULL DEFAULT true,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_customize boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module_name)
);

-- Enable RLS
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage permissions
CREATE POLICY "Admins can manage permissions" ON public.module_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- All authenticated users can view permissions (to check their own)
CREATE POLICY "Users can view permissions" ON public.module_permissions
  FOR SELECT USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_module_permissions_updated_at
  BEFORE UPDATE ON public.module_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions for admin role (full access)
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize) VALUES
  ('admin', 'dashboard', true, true, true, true, true),
  ('admin', 'import', true, true, true, true, true),
  ('admin', 'allocation', true, true, true, true, true),
  ('admin', 'payables', true, true, true, true, true),
  ('admin', 'doctors', true, true, true, true, true),
  ('admin', 'hospitals', true, true, true, true, true),
  ('admin', 'banks', true, true, true, true, true),
  ('admin', 'users', true, true, true, true, true),
  ('admin', 'permissions', true, true, true, true, true);

-- Insert default permissions for operador role (limited access)
INSERT INTO public.module_permissions (role, module_name, can_create, can_read, can_update, can_delete, can_customize) VALUES
  ('operador', 'dashboard', false, true, false, false, false),
  ('operador', 'import', true, true, true, false, false),
  ('operador', 'allocation', true, true, true, false, false),
  ('operador', 'payables', true, true, true, false, false),
  ('operador', 'doctors', false, true, false, false, false),
  ('operador', 'hospitals', false, true, false, false, false),
  ('operador', 'banks', false, true, false, false, false),
  ('operador', 'users', false, true, false, false, false),
  ('operador', 'permissions', false, false, false, false, false);