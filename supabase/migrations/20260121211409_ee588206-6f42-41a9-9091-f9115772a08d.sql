-- Add supplier field to expenses table
ALTER TABLE public.expenses 
ADD COLUMN supplier TEXT;