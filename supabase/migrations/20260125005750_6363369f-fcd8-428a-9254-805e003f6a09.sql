-- Adicionar coluna is_iss_retained na tabela invoices
ALTER TABLE public.invoices 
ADD COLUMN is_iss_retained boolean DEFAULT true;