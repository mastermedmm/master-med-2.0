-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('aguardando_recebimento', 'pendente', 'pago', 'cancelado');

-- Create enum for receipt status
CREATE TYPE public.receipt_status AS ENUM ('pendente', 'recebido');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'operador',
  UNIQUE (user_id, role)
);

-- Hospitals/Clients table
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Doctors table
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  crm TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoices table (notas fiscais)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_url TEXT,
  pdf_hash TEXT UNIQUE,
  company_name TEXT NOT NULL,
  hospital_id UUID REFERENCES public.hospitals(id),
  hospital_name TEXT NOT NULL,
  issue_date DATE NOT NULL,
  invoice_number TEXT NOT NULL,
  gross_value DECIMAL(15,2) NOT NULL,
  total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_value DECIMAL(15,2) NOT NULL,
  expected_receipt_date DATE NOT NULL,
  status receipt_status NOT NULL DEFAULT 'pendente',
  receipt_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoice allocations (rateio por médico)
CREATE TABLE public.invoice_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  allocated_net_value DECIMAL(15,2) NOT NULL,
  admin_fee DECIMAL(15,2) NOT NULL,
  amount_to_pay DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Accounts payable (contas a pagar - médicos)
CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  allocation_id UUID REFERENCES public.invoice_allocations(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  allocated_net_value DECIMAL(15,2) NOT NULL,
  admin_fee DECIMAL(15,2) NOT NULL,
  amount_to_pay DECIMAL(15,2) NOT NULL,
  expected_payment_date DATE,
  status payment_status NOT NULL DEFAULT 'aguardando_recebimento',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles (admin only can manage)
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for hospitals (authenticated users)
CREATE POLICY "Authenticated users can view hospitals" ON public.hospitals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage hospitals" ON public.hospitals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for doctors (authenticated users)
CREATE POLICY "Authenticated users can view doctors" ON public.doctors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage doctors" ON public.doctors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for invoices (authenticated users)
CREATE POLICY "Authenticated users can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage invoices" ON public.invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for invoice_allocations (authenticated users)
CREATE POLICY "Authenticated users can view allocations" ON public.invoice_allocations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage allocations" ON public.invoice_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for accounts_payable (authenticated users)
CREATE POLICY "Authenticated users can view accounts payable" ON public.accounts_payable
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage accounts payable" ON public.accounts_payable
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_payable_updated_at BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'operador');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload PDFs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can view PDFs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can delete PDFs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'invoices');