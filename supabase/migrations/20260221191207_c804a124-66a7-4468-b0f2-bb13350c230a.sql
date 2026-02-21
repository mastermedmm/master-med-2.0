
-- Remove duplicate invoice records (keeping the original from 2026-02-02)
-- First delete accounts_payable for duplicates
DELETE FROM accounts_payable 
WHERE invoice_id IN ('f6f02fc8-e1ba-4e3c-94ad-e3a7dfeb26ae', '5368c96f-6be8-4c2f-b014-303618335ba9');

-- Delete invoice_allocations for duplicates
DELETE FROM invoice_allocations 
WHERE invoice_id IN ('f6f02fc8-e1ba-4e3c-94ad-e3a7dfeb26ae', '5368c96f-6be8-4c2f-b014-303618335ba9');

-- Delete the duplicate invoices
DELETE FROM invoices 
WHERE id IN ('f6f02fc8-e1ba-4e3c-94ad-e3a7dfeb26ae', '5368c96f-6be8-4c2f-b014-303618335ba9');
