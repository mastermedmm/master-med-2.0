-- Create banks table
CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  agency TEXT,
  account_number TEXT,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on banks
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view banks"
ON public.banks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage banks"
ON public.banks FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_banks_updated_at
BEFORE UPDATE ON public.banks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new status to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'parcialmente_pago';

-- Create payments table for tracking partial payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reversed_at TIMESTAMP WITH TIME ZONE,
  reversed_by UUID REFERENCES auth.users(id),
  reversal_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
ON public.payments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage payments"
ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_payments_account_payable_id ON public.payments(account_payable_id);
CREATE INDEX idx_payments_bank_id ON public.payments(bank_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date DESC);