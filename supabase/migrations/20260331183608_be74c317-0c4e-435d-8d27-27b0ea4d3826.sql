CREATE TABLE public.whatsapp_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  invoice_id uuid REFERENCES public.invoices(id),
  doctor_id uuid REFERENCES public.doctors(id),
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  meta_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage whatsapp_notifications_log"
  ON public.whatsapp_notifications_log
  FOR ALL
  TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view whatsapp_notifications_log"
  ON public.whatsapp_notifications_log
  FOR SELECT
  TO authenticated
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));