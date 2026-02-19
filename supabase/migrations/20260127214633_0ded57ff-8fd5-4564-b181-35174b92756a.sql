-- Create unique constraint for tenant_id + cpf to enable upsert
ALTER TABLE public.doctors ADD CONSTRAINT doctors_tenant_cpf_unique UNIQUE (tenant_id, cpf);