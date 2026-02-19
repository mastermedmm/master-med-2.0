-- Create audit_logs table for tracking all CRUD operations
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  record_id text NOT NULL,
  record_label text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view audit logs for their tenant
CREATE POLICY "Tenant admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- RLS Policy: Authenticated users can insert audit logs for their tenant
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
);

-- Insert default permissions for audit_logs module for all existing tenants
INSERT INTO public.module_permissions (tenant_id, role, module_name, can_create, can_read, can_update, can_delete, can_customize)
SELECT 
  t.id as tenant_id,
  r.role,
  'audit_logs' as module_name,
  CASE WHEN r.role = 'admin' THEN true ELSE false END as can_create,
  CASE WHEN r.role = 'admin' THEN true ELSE false END as can_read,
  CASE WHEN r.role = 'admin' THEN true ELSE false END as can_update,
  CASE WHEN r.role = 'admin' THEN true ELSE false END as can_delete,
  CASE WHEN r.role = 'admin' THEN true ELSE false END as can_customize
FROM public.tenants t
CROSS JOIN (
  SELECT 'admin'::app_role as role
  UNION ALL SELECT 'operador'::app_role
  UNION ALL SELECT 'financeiro'::app_role
) r
ON CONFLICT DO NOTHING;