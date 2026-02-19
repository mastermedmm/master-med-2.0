-- Remove old unique constraint on cpf only (to allow same CPF in different tenants)
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_cpf_key;