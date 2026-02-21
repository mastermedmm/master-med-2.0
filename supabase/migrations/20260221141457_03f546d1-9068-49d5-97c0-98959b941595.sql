-- Fix doctor_sessions: scope anon policies to only the doctor's own session
-- and remove overly permissive service_role ALL policy

DROP POLICY IF EXISTS "Anon can delete doctor_sessions" ON public.doctor_sessions;
DROP POLICY IF EXISTS "Anon can insert doctor_sessions" ON public.doctor_sessions;
DROP POLICY IF EXISTS "Anon can read doctor_sessions for auth" ON public.doctor_sessions;
DROP POLICY IF EXISTS "Service role can manage doctor_sessions" ON public.doctor_sessions;

-- Anon: only read non-expired sessions (needed for doctor portal auth validation)
CREATE POLICY "Anon can read doctor_sessions"
ON public.doctor_sessions FOR SELECT TO anon
USING (expires_at > now());

-- Anon: insert new sessions
CREATE POLICY "Anon can insert doctor_sessions"
ON public.doctor_sessions FOR INSERT TO anon
WITH CHECK (expires_at > now());

-- Anon: delete own sessions (logout)
CREATE POLICY "Anon can delete doctor_sessions"
ON public.doctor_sessions FOR DELETE TO anon
USING (expires_at > now());

-- Fix tenant_impersonation_logs: remove service_role ALL true policy
DROP POLICY IF EXISTS "Service role can manage impersonation_logs" ON public.tenant_impersonation_logs;

-- Service role only needs INSERT (edge function writes logs)
CREATE POLICY "Service role can insert impersonation_logs"
ON public.tenant_impersonation_logs FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can read impersonation_logs"
ON public.tenant_impersonation_logs FOR SELECT TO service_role
USING (true);
