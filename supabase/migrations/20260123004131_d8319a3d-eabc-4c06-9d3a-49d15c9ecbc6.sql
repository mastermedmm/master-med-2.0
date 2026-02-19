-- Remove the old unique constraint that doesn't include tenant_id
ALTER TABLE public.module_permissions DROP CONSTRAINT IF EXISTS module_permissions_role_module_name_key;

-- Create new unique constraint that includes tenant_id
CREATE UNIQUE INDEX module_permissions_tenant_role_module_key 
ON public.module_permissions (tenant_id, role, module_name);