-- Create unique constraint for tenant_id + key combination
ALTER TABLE public.system_settings 
ADD CONSTRAINT system_settings_tenant_key_unique UNIQUE (tenant_id, key);