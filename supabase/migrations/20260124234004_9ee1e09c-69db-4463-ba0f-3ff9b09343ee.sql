-- Add new columns to doctors table for expanded registration
ALTER TABLE doctors
ADD COLUMN phone text,
ADD COLUMN bank_name text,
ADD COLUMN pix_key text,
ADD COLUMN bank_agency text,
ADD COLUMN bank_account text,
ADD COLUMN is_freelancer boolean NOT NULL DEFAULT false,
ADD COLUMN birth_date date,
ADD COLUMN address text,
ADD COLUMN neighborhood text,
ADD COLUMN zip_code text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN certificate_expires_at date;