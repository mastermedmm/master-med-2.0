-- Add bank_id column to invoices table for bank filtering in Cash Flow
ALTER TABLE public.invoices ADD COLUMN bank_id UUID REFERENCES public.banks(id);

-- Add index for better query performance
CREATE INDEX idx_invoices_bank_id ON public.invoices(bank_id);
CREATE INDEX idx_invoices_status_receipt_date ON public.invoices(status, receipt_date) WHERE status = 'recebido' AND receipt_date IS NOT NULL;