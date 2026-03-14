ALTER TABLE public.contratos
  ADD COLUMN tipo_contrato_id uuid REFERENCES public.juridico_tipos_contrato(id);