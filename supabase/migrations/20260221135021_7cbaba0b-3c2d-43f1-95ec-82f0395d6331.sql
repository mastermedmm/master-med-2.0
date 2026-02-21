
DO $$ BEGIN

-- Revenues
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenues_bank_id_fkey') THEN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenues_category_id_fkey') THEN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.revenue_categories(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenues_tenant_id_fkey') THEN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenues_statement_import_id_fkey') THEN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_statement_import_id_fkey FOREIGN KEY (statement_import_id) REFERENCES public.bank_statement_imports(id) ON DELETE SET NULL;
END IF;

-- Expenses
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_bank_id_fkey') THEN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_category_id_fkey') THEN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_tenant_id_fkey') THEN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_statement_import_id_fkey') THEN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_statement_import_id_fkey FOREIGN KEY (statement_import_id) REFERENCES public.bank_statement_imports(id) ON DELETE SET NULL;
END IF;

-- Payments
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_bank_id_fkey') THEN
  ALTER TABLE public.payments ADD CONSTRAINT payments_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_account_payable_id_fkey') THEN
  ALTER TABLE public.payments ADD CONSTRAINT payments_account_payable_id_fkey FOREIGN KEY (account_payable_id) REFERENCES public.accounts_payable(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_tenant_id_fkey') THEN
  ALTER TABLE public.payments ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Invoice Receipts
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_receipts_bank_id_fkey') THEN
  ALTER TABLE public.invoice_receipts ADD CONSTRAINT invoice_receipts_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_receipts_invoice_id_fkey') THEN
  ALTER TABLE public.invoice_receipts ADD CONSTRAINT invoice_receipts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_receipts_tenant_id_fkey') THEN
  ALTER TABLE public.invoice_receipts ADD CONSTRAINT invoice_receipts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_receipts_imported_transaction_id_fkey') THEN
  ALTER TABLE public.invoice_receipts ADD CONSTRAINT invoice_receipts_imported_transaction_id_fkey FOREIGN KEY (imported_transaction_id) REFERENCES public.imported_transactions(id) ON DELETE SET NULL;
END IF;

-- Accounts Payable
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_payable_doctor_id_fkey') THEN
  ALTER TABLE public.accounts_payable ADD CONSTRAINT accounts_payable_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_payable_invoice_id_fkey') THEN
  ALTER TABLE public.accounts_payable ADD CONSTRAINT accounts_payable_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_payable_allocation_id_fkey') THEN
  ALTER TABLE public.accounts_payable ADD CONSTRAINT accounts_payable_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.invoice_allocations(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_payable_tenant_id_fkey') THEN
  ALTER TABLE public.accounts_payable ADD CONSTRAINT accounts_payable_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Invoice Allocations
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_allocations_doctor_id_fkey') THEN
  ALTER TABLE public.invoice_allocations ADD CONSTRAINT invoice_allocations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_allocations_invoice_id_fkey') THEN
  ALTER TABLE public.invoice_allocations ADD CONSTRAINT invoice_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_allocations_tenant_id_fkey') THEN
  ALTER TABLE public.invoice_allocations ADD CONSTRAINT invoice_allocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Receipt Payment Adjustments
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_adjustments_bank_id_fkey') THEN
  ALTER TABLE public.receipt_payment_adjustments ADD CONSTRAINT receipt_payment_adjustments_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_adjustments_invoice_id_fkey') THEN
  ALTER TABLE public.receipt_payment_adjustments ADD CONSTRAINT receipt_payment_adjustments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_adjustments_account_payable_id_fkey') THEN
  ALTER TABLE public.receipt_payment_adjustments ADD CONSTRAINT receipt_payment_adjustments_account_payable_id_fkey FOREIGN KEY (account_payable_id) REFERENCES public.accounts_payable(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_adjustments_tenant_id_fkey') THEN
  ALTER TABLE public.receipt_payment_adjustments ADD CONSTRAINT receipt_payment_adjustments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Imported Transactions
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_transactions_bank_id_fkey') THEN
  ALTER TABLE public.imported_transactions ADD CONSTRAINT imported_transactions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_transactions_import_id_fkey') THEN
  ALTER TABLE public.imported_transactions ADD CONSTRAINT imported_transactions_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_transactions_tenant_id_fkey') THEN
  ALTER TABLE public.imported_transactions ADD CONSTRAINT imported_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Bank Statement Imports
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_imports_bank_id_fkey') THEN
  ALTER TABLE public.bank_statement_imports ADD CONSTRAINT bank_statement_imports_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE RESTRICT;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_imports_tenant_id_fkey') THEN
  ALTER TABLE public.bank_statement_imports ADD CONSTRAINT bank_statement_imports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Invoices
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_hospital_id_fkey') THEN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_issuer_id_fkey') THEN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_issuer_id_fkey FOREIGN KEY (issuer_id) REFERENCES public.issuers(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_bank_id_fkey') THEN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenant_id_fkey') THEN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Expense Categories
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_categories_group_id_fkey') THEN
  ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.expense_groups(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_categories_tenant_id_fkey') THEN
  ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Revenue Categories
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_categories_group_id_fkey') THEN
  ALTER TABLE public.revenue_categories ADD CONSTRAINT revenue_categories_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.revenue_groups(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_categories_tenant_id_fkey') THEN
  ALTER TABLE public.revenue_categories ADD CONSTRAINT revenue_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Doctors
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_tenant_id_fkey') THEN
  ALTER TABLE public.doctors ADD CONSTRAINT doctors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Hospitals
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitals_tenant_id_fkey') THEN
  ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Issuers
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issuers_tenant_id_fkey') THEN
  ALTER TABLE public.issuers ADD CONSTRAINT issuers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Banks
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banks_tenant_id_fkey') THEN
  ALTER TABLE public.banks ADD CONSTRAINT banks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Profiles
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tenant_id_fkey') THEN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_active_tenant_id_fkey') THEN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_active_tenant_id_fkey FOREIGN KEY (active_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
END IF;

-- User Roles
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_tenant_id_fkey') THEN
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Audit Logs
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_tenant_id_fkey') THEN
  ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Column Preferences
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'column_preferences_tenant_id_fkey') THEN
  ALTER TABLE public.column_preferences ADD CONSTRAINT column_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- System Settings
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_tenant_id_fkey') THEN
  ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Module Permissions
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_permissions_tenant_id_fkey') THEN
  ALTER TABLE public.module_permissions ADD CONSTRAINT module_permissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

-- Doctor Sessions
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_sessions_doctor_id_fkey') THEN
  ALTER TABLE public.doctor_sessions ADD CONSTRAINT doctor_sessions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;
END IF;

-- Sieg Sync Logs
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sieg_sync_logs_tenant_id_fkey') THEN
  ALTER TABLE public.sieg_sync_logs ADD CONSTRAINT sieg_sync_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END IF;

END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
