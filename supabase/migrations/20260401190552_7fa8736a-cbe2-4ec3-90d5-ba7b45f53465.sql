ALTER TABLE public.whatsapp_notifications_log
  ADD COLUMN IF NOT EXISTS meta_response jsonb,
  ADD COLUMN IF NOT EXISTS request_payload jsonb;