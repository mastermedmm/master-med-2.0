-- Add invoice_type column to identify the standard (SPED or ABRASF)
ALTER TABLE public.invoices 
ADD COLUMN invoice_type text NOT NULL DEFAULT 'ABRASF';