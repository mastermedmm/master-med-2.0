-- Add aliquota column to doctors table
ALTER TABLE public.doctors
ADD COLUMN aliquota numeric NOT NULL DEFAULT 0;