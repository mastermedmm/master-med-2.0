-- Create revenue_categories table
CREATE TABLE public.revenue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenue_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies (using get_user_tenant_id function like other tables)
CREATE POLICY "Tenant users can view revenue categories"
ON public.revenue_categories
FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage revenue categories"
ON public.revenue_categories
FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Insert default category for all existing tenants
INSERT INTO public.revenue_categories (tenant_id, name, description, active)
SELECT id, 'Recebimento de Unidade', 'Recebimento de valores de unidades/hospitais', true
FROM public.tenants;

-- Add category_id column to revenues table
ALTER TABLE public.revenues 
ADD COLUMN category_id uuid REFERENCES public.revenue_categories(id);

-- Create trigger for updated_at
CREATE TRIGGER update_revenue_categories_updated_at
BEFORE UPDATE ON public.revenue_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();