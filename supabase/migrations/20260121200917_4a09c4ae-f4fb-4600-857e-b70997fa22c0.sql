-- Create system_settings table for storing app-wide configurations
CREATE TABLE public.system_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value text,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage system settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read settings (for portal link usage)
CREATE POLICY "Authenticated users can view settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (key, value, description) VALUES
('doctor_portal_link', '', 'Link externo exibido no botão do Portal do Médico');

-- Add permissions for Settings module (admin only)
INSERT INTO public.module_permissions (module_name, role, can_create, can_read, can_update, can_delete, can_customize)
VALUES 
('settings', 'admin', true, true, true, true, true),
('settings', 'operador', false, false, false, false, false);