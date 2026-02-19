-- Add proportional ISS and deductions columns to invoice_allocations
ALTER TABLE public.invoice_allocations
ADD COLUMN proportional_iss numeric NOT NULL DEFAULT 0,
ADD COLUMN proportional_deductions numeric NOT NULL DEFAULT 0;

-- Add proportional ISS and deductions columns to accounts_payable
ALTER TABLE public.accounts_payable
ADD COLUMN proportional_iss numeric NOT NULL DEFAULT 0,
ADD COLUMN proportional_deductions numeric NOT NULL DEFAULT 0;