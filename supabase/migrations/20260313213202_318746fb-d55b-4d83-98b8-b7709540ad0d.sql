
-- Fix expenses created via reconciliation: set paid_at to transaction_date
UPDATE expenses e
SET paid_at = (it.transaction_date || 'T12:00:00-03:00')::timestamptz
FROM imported_transactions it
WHERE e.id::text = it.created_record_id::text
AND it.created_record_type = 'expense'
AND e.paid_at IS NOT NULL
AND e.paid_at::date != it.transaction_date;

-- Fix accounts_payable paid_at to transaction_date
UPDATE accounts_payable ap
SET paid_at = (it.transaction_date || 'T12:00:00-03:00')::timestamptz
FROM imported_transactions it
WHERE ap.id::text = it.reconciled_with_id::text
AND it.reconciled_with_type = 'payable'
AND it.status = 'conciliado'
AND ap.paid_at IS NOT NULL
AND ap.paid_at::date != it.transaction_date;

-- Update old 'criado' status to 'conciliado'
UPDATE imported_transactions
SET status = 'conciliado'
WHERE status = 'criado';
