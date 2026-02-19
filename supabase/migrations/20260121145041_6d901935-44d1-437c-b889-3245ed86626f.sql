-- Create table for global column preferences
CREATE TABLE public.column_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  visible_columns text[] NOT NULL DEFAULT '{}',
  column_order text[] NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.column_preferences ENABLE ROW LEVEL SECURITY;

-- Everyone can read preferences
CREATE POLICY "Everyone can view column preferences" ON public.column_preferences
  FOR SELECT USING (true);

-- Only admins can manage preferences
CREATE POLICY "Admins can manage column preferences" ON public.column_preferences
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_column_preferences_updated_at
  BEFORE UPDATE ON public.column_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default preferences for payables module
INSERT INTO public.column_preferences (module_name, visible_columns, column_order) VALUES
  ('payables', 
   ARRAY['doctor', 'hospital', 'invoiceNumber', 'allocatedValue', 'aliquota', 'adminFee', 'totalPaid', 'amountToPay', 'status'],
   ARRAY['doctor', 'company', 'hospital', 'invoiceNumber', 'grossValue', 'deductions', 'issValue', 'netValue', 'allocatedValue', 'proportionalIss', 'proportionalDeductions', 'aliquota', 'adminFee', 'totalPaid', 'amountToPay', 'expectedPaymentDate', 'paidAt', 'createdAt', 'status']
  );