-- 1. Add new status to receipt_status enum
ALTER TYPE receipt_status ADD VALUE 'parcialmente_recebido';

-- 2. Create invoice_receipts table (similar to payments table)
CREATE TABLE invoice_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  imported_transaction_id UUID REFERENCES imported_transactions(id),
  bank_id UUID NOT NULL REFERENCES banks(id),
  
  -- Values
  amount NUMERIC NOT NULL,
  receipt_date DATE NOT NULL,
  
  -- Reversal
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  reversal_reason TEXT,
  
  -- Adjustment (if there's a difference in this specific receipt)
  adjustment_amount NUMERIC DEFAULT 0,
  adjustment_reason TEXT,
  
  -- Audit
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add total_received column to invoices table for caching
ALTER TABLE invoices ADD COLUMN total_received NUMERIC DEFAULT 0;

-- 4. Enable RLS
ALTER TABLE invoice_receipts ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY "Tenant users can view invoice receipts"
  ON invoice_receipts FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage invoice receipts"
  ON invoice_receipts FOR ALL
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- 6. Create trigger for updated_at
CREATE TRIGGER update_invoice_receipts_updated_at
  BEFORE UPDATE ON invoice_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();