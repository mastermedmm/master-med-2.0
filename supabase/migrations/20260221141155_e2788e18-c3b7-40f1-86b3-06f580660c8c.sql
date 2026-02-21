-- Fix RESTRICTIVE policies -> PERMISSIVE for column_preferences, doctor_sessions, tenant_impersonation_logs
-- Drop and recreate as PERMISSIVE

-- column_preferences
DROP POLICY IF EXISTS "Tenant users can view column_preferences" ON public.column_preferences;
DROP POLICY IF EXISTS "Tenant users can manage column_preferences" ON public.column_preferences;

CREATE POLICY "Tenant users can view column_preferences"
ON public.column_preferences FOR SELECT TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage column_preferences"
ON public.column_preferences FOR ALL TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- doctor_sessions
DROP POLICY IF EXISTS "Service role can manage doctor_sessions" ON public.doctor_sessions;
DROP POLICY IF EXISTS "Anon can read doctor_sessions for auth" ON public.doctor_sessions;
DROP POLICY IF EXISTS "Anon can insert doctor_sessions" ON public.doctor_sessions;
DROP POLICY IF EXISTS "Anon can delete doctor_sessions" ON public.doctor_sessions;

CREATE POLICY "Service role can manage doctor_sessions"
ON public.doctor_sessions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read doctor_sessions for auth"
ON public.doctor_sessions FOR SELECT TO anon
USING (true);

CREATE POLICY "Anon can insert doctor_sessions"
ON public.doctor_sessions FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Anon can delete doctor_sessions"
ON public.doctor_sessions FOR DELETE TO anon
USING (true);

-- tenant_impersonation_logs
DROP POLICY IF EXISTS "Super admins can view impersonation_logs" ON public.tenant_impersonation_logs;
DROP POLICY IF EXISTS "Super admins can insert impersonation_logs" ON public.tenant_impersonation_logs;
DROP POLICY IF EXISTS "Service role can manage impersonation_logs" ON public.tenant_impersonation_logs;

CREATE POLICY "Super admins can view impersonation_logs"
ON public.tenant_impersonation_logs FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert impersonation_logs"
ON public.tenant_impersonation_logs FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Service role can manage impersonation_logs"
ON public.tenant_impersonation_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);
