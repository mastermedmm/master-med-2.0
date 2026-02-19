-- Drop the old unique constraint on key only (it doesn't consider tenant_id)
ALTER TABLE public.system_settings 
DROP CONSTRAINT IF EXISTS system_settings_key_key;

-- The new constraint system_settings_tenant_key_unique (tenant_id, key) was already added
-- and properly allows different tenants to have the same key