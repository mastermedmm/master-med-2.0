-- Tabela para armazenar ajustes de recebimento e pagamento
CREATE TABLE public.receipt_payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  
  -- Tipo de ajuste
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('recebimento', 'pagamento')),
  
  -- Relacionamentos
  invoice_id UUID REFERENCES public.invoices(id),
  account_payable_id UUID REFERENCES public.accounts_payable(id),
  imported_transaction_id UUID REFERENCES public.imported_transactions(id),
  bank_id UUID REFERENCES public.banks(id),
  
  -- Valores
  expected_amount NUMERIC NOT NULL,
  received_amount NUMERIC NOT NULL,
  adjustment_amount NUMERIC NOT NULL,
  
  -- Detalhes
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.receipt_payment_adjustments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant users can view adjustments"
  ON public.receipt_payment_adjustments FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage adjustments"
  ON public.receipt_payment_adjustments FOR ALL
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_receipt_payment_adjustments_updated_at
  BEFORE UPDATE ON public.receipt_payment_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();