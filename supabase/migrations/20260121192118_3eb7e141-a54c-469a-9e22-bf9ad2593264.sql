-- Add portal authentication fields to doctors table
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS portal_password_hash text,
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;

-- Create doctor sessions table for portal authentication
CREATE TABLE public.doctor_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on doctor_sessions
ALTER TABLE public.doctor_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Only the system (edge functions with service role) can manage sessions
CREATE POLICY "Service role can manage doctor sessions"
ON public.doctor_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster session lookups
CREATE INDEX idx_doctor_sessions_token ON public.doctor_sessions(session_token);
CREATE INDEX idx_doctor_sessions_doctor_id ON public.doctor_sessions(doctor_id);
CREATE INDEX idx_doctor_sessions_expires_at ON public.doctor_sessions(expires_at);

-- Add comment for documentation
COMMENT ON COLUMN public.doctors.portal_password_hash IS 'Bcrypt hash of the doctor portal password';
COMMENT ON COLUMN public.doctors.must_change_password IS 'Flag to force password change on first login';
COMMENT ON COLUMN public.doctors.last_login_at IS 'Timestamp of last portal login';