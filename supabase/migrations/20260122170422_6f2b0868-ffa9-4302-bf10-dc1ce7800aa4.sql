
-- Corrigir RLS da tabela doctor_sessions (era USING true)
DROP POLICY IF EXISTS "Service role can manage doctor sessions" ON public.doctor_sessions;

-- Apenas super admins e service role podem gerenciar sessões de médicos
CREATE POLICY "Super admins can manage doctor sessions"
ON public.doctor_sessions FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
