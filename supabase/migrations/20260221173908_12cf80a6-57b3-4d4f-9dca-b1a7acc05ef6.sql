
-- Add licensee_id to doctors table
ALTER TABLE public.doctors ADD COLUMN licensee_id uuid REFERENCES public.licensees(id);

-- Add auth fields to licensees table
ALTER TABLE public.licensees ADD COLUMN portal_password_hash text;
ALTER TABLE public.licensees ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE public.licensees ADD COLUMN last_login_at timestamptz;

-- Create licensee_sessions table
CREATE TABLE public.licensee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licensee_id uuid NOT NULL REFERENCES public.licensees(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licensee_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for licensee_sessions (anon access like doctor_sessions)
CREATE POLICY "Anon can read licensee_sessions" ON public.licensee_sessions
  FOR SELECT TO anon, authenticated USING (expires_at > now());

CREATE POLICY "Anon can insert licensee_sessions" ON public.licensee_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (expires_at > now());

CREATE POLICY "Anon can delete licensee_sessions" ON public.licensee_sessions
  FOR DELETE TO anon, authenticated USING (expires_at > now());
