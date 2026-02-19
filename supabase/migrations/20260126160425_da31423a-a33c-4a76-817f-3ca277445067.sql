-- Remove the old unique constraint on module_name only (which breaks multi-tenancy)
ALTER TABLE public.column_preferences DROP CONSTRAINT column_preferences_module_name_key;

-- Create a new unique constraint on (tenant_id, module_name) to support UPSERT per tenant
CREATE UNIQUE INDEX idx_column_preferences_tenant_module 
ON public.column_preferences(tenant_id, module_name);