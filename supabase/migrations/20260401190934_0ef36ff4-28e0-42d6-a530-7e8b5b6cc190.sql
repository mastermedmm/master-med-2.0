ALTER TABLE public.whatsapp_notifications_log
  DROP CONSTRAINT whatsapp_notifications_log_invoice_id_fkey,
  ADD CONSTRAINT whatsapp_notifications_log_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_notifications_log
  DROP CONSTRAINT whatsapp_notifications_log_doctor_id_fkey,
  ADD CONSTRAINT whatsapp_notifications_log_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;