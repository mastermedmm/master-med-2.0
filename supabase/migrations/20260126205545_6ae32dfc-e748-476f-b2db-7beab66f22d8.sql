-- Create revenue_groups table (similar to expense_groups)
CREATE TABLE public.revenue_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'revenue',
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenue_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Tenant users can view revenue groups"
  ON public.revenue_groups FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage revenue groups"
  ON public.revenue_groups FOR ALL
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Add group_id to revenue_categories
ALTER TABLE public.revenue_categories 
  ADD COLUMN group_id UUID REFERENCES public.revenue_groups(id),
  ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;

-- Create trigger for updated_at
CREATE TRIGGER update_revenue_groups_updated_at
  BEFORE UPDATE ON public.revenue_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();