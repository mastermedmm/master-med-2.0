
-- =============================================
-- RLS policies para column_preferences
-- =============================================
ALTER TABLE public.column_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view column_preferences"
ON public.column_preferences
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

CREATE POLICY "Tenant users can manage column_preferences"
ON public.column_preferences
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())
);

-- =============================================
-- RLS policies para doctor_sessions
-- =============================================
ALTER TABLE public.doctor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage doctor_sessions"
ON public.doctor_sessions
AS RESTRICTIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can read doctor_sessions for auth"
ON public.doctor_sessions
AS RESTRICTIVE
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert doctor_sessions"
ON public.doctor_sessions
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can delete doctor_sessions"
ON public.doctor_sessions
AS RESTRICTIVE
FOR DELETE
TO anon
USING (true);

-- =============================================
-- RLS policies para tenant_impersonation_logs
-- =============================================
ALTER TABLE public.tenant_impersonation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view impersonation_logs"
ON public.tenant_impersonation_logs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert impersonation_logs"
ON public.tenant_impersonation_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Service role can manage impersonation_logs"
ON public.tenant_impersonation_logs
AS RESTRICTIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
