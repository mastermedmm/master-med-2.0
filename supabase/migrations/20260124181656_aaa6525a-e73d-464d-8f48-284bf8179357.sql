-- Create imported_transactions table for persistent reconciliation
CREATE TABLE public.imported_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  bank_id UUID REFERENCES banks(id) NOT NULL,
  import_id UUID REFERENCES bank_statement_imports(id) NOT NULL,
  
  -- OFX transaction data
  external_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT NOT NULL,
  raw_type TEXT,
  
  -- Reconciliation status
  status TEXT NOT NULL DEFAULT 'pendente',
  
  -- Reconciliation data
  reconciled_with_type TEXT,
  reconciled_with_id UUID,
  created_record_type TEXT,
  created_record_id UUID,
  
  -- Auto-suggestion
  suggested_match_type TEXT,
  suggested_match_id UUID,
  suggested_confidence TEXT,
  
  -- Manual classification
  category_id UUID,
  custom_description TEXT,
  source TEXT,
  
  -- Metadata
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Prevent duplicates per bank
  UNIQUE(bank_id, external_id)
);

-- Add status column to bank_statement_imports
ALTER TABLE bank_statement_imports 
ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';

-- Enable RLS
ALTER TABLE public.imported_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for imported_transactions
CREATE POLICY "Tenant users can view imported transactions"
ON public.imported_transactions
FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage imported transactions"
ON public.imported_transactions
FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));