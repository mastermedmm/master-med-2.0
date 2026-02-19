-- Table to track bank statement imports (prevent duplicates)
CREATE TABLE public.bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_statement_imports
CREATE POLICY "Tenant users can view bank statement imports"
ON public.bank_statement_imports
FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage bank statement imports"
ON public.bank_statement_imports
FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Table for revenues (credit transactions)
CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  revenue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  statement_import_id UUID REFERENCES public.bank_statement_imports(id) ON DELETE SET NULL,
  external_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;

-- RLS policies for revenues
CREATE POLICY "Tenant users can view revenues"
ON public.revenues
FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage revenues"
ON public.revenues
FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Add columns to expenses table for import tracking
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS statement_import_id UUID REFERENCES public.bank_statement_imports(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_expenses_external_id ON public.expenses(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revenues_external_id ON public.revenues(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_file_hash ON public.bank_statement_imports(file_hash, bank_id);