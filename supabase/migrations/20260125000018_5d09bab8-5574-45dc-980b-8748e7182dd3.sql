-- Add linked company fields to doctors table
ALTER TABLE doctors
ADD COLUMN linked_company text,
ADD COLUMN linked_company_2 text;