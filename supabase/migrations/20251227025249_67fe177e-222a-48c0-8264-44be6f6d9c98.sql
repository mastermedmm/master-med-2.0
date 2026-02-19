-- Add ISS column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN iss_value numeric NOT NULL DEFAULT 0;