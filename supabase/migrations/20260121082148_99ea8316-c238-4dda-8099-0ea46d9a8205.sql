-- Add individual tax columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS iss_percentage numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS irrf_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS inss_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS csll_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_value numeric NOT NULL DEFAULT 0;