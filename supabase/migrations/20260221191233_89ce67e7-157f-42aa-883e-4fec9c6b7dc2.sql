
-- Add unique constraint to prevent duplicate invoices per tenant + company + invoice_number
CREATE UNIQUE INDEX idx_invoices_unique_per_tenant_company 
ON invoices (tenant_id, company_name, invoice_number);
