import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { OFXTransaction } from '@/utils/parseOFX';
import { toast } from 'sonner';
import { nowBrasilia, toBrasiliaDate, todayBrasilia } from '@/lib/utils';

export interface ImportedTransaction {
  id: string;
  bank_id: string;
  import_id: string;
  external_id: string;
  transaction_date: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  description: string;
  raw_type: string | null;
  status: 'pendente' | 'conciliado' | 'criado' | 'ignorado';
  reconciled_with_type: string | null;
  reconciled_with_id: string | null;
  created_record_type: string | null;
  created_record_id: string | null;
  suggested_match_type: string | null;
  suggested_match_id: string | null;
  suggested_confidence: string | null;
  category_id: string | null;
  custom_description: string | null;
  source: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
  banks?: { name: string };
  bank_statement_imports?: { file_name: string };
}

export interface ReconciliationSuggestion {
  matchType: 'expense' | 'invoice';
  matchId: string;
  matchDescription: string;
  matchAmount: number;
  matchDate: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface PendingExpense {
  id: string;
  amount: number;
  due_date: string | null;
  description: string;
  supplier: string | null;
}

interface PendingInvoice {
  id: string;
  net_value: number;
  expected_receipt_date: string;
  company_name: string;
  invoice_number: string;
}

export function useImportedTransactions() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Import OFX transactions to database (persisted for later reconciliation)
   */
  const importOFXTransactions = useCallback(async (
    transactions: OFXTransaction[],
    bankId: string,
    fileName: string,
    fileHash: string
  ): Promise<{ success: boolean; imported: number; skipped: number; importId: string | null }> => {
    if (!tenantId || !user) {
      toast.error('Erro de contexto: tenant ou usuário não disponível');
      return { success: false, imported: 0, skipped: 0, importId: null };
    }

    setIsLoading(true);
    
    try {
      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('bank_statement_imports')
        .insert({
          tenant_id: tenantId,
          bank_id: bankId,
          file_name: fileName,
          file_hash: fileHash,
          transaction_count: transactions.length,
          imported_by: user.id,
          status: 'pendente',
        })
        .select('id')
        .single();

      if (importError) {
        console.error('Error creating import record:', importError);
        toast.error('Erro ao registrar importação');
        return { success: false, imported: 0, skipped: 0, importId: null };
      }

      // Fetch pending expenses and invoices for auto-suggestions - FILTERED BY TENANT
      const [{ data: pendingExpenses }, { data: pendingInvoices }] = await Promise.all([
        supabase
          .from('expenses')
          .select('id, amount, due_date, description, supplier')
          .eq('tenant_id', tenantId)
          .eq('status', 'pendente')
          .is('bank_id', null),
        supabase
          .from('invoices')
          .select('id, net_value, expected_receipt_date, company_name, invoice_number')
          .eq('tenant_id', tenantId)
          .eq('status', 'pendente'),
      ]);

      let imported = 0;
      let skipped = 0;

      for (const transaction of transactions) {
        // Find best match for suggestion
        const suggestion = findBestMatch(
          transaction,
          (pendingExpenses as PendingExpense[]) || [],
          (pendingInvoices as PendingInvoice[]) || []
        );

        // Try to insert (will fail silently if duplicate due to UNIQUE constraint)
        const { error } = await supabase
          .from('imported_transactions')
          .insert({
            tenant_id: tenantId,
            bank_id: bankId,
            import_id: importRecord.id,
            external_id: transaction.id,
            transaction_date: toBrasiliaDate(transaction.date),
            amount: transaction.amount,
            transaction_type: transaction.type,
            description: transaction.description,
            raw_type: transaction.rawType || null,
            status: 'pendente',
            suggested_match_type: suggestion?.matchType || null,
            suggested_match_id: suggestion?.matchId || null,
            suggested_confidence: suggestion?.confidence || null,
          });

        if (error) {
          if (error.code === '23505') {
            // Duplicate - skip
            skipped++;
          } else {
            console.error('Error inserting transaction:', error);
          }
        } else {
          imported++;
        }
      }

      // Update import status
      await supabase
        .from('bank_statement_imports')
        .update({ 
          transaction_count: imported,
          status: imported > 0 ? 'pendente' : 'concluido'
        })
        .eq('id', importRecord.id);

      if (imported > 0) {
        toast.success(`${imported} transações importadas${skipped > 0 ? `, ${skipped} já existiam` : ''}`);
      } else if (skipped > 0) {
        toast.info(`Todas as ${skipped} transações já foram importadas anteriormente`);
      }

      return { success: true, imported, skipped, importId: importRecord.id };
    } catch (error) {
      console.error('Error importing transactions:', error);
      toast.error('Erro ao importar transações');
      return { success: false, imported: 0, skipped: 0, importId: null };
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user]);

  /**
   * Fetch pending transactions for reconciliation
   */
  const fetchPendingTransactions = useCallback(async (
    filters?: { bankId?: string; importId?: string; status?: string }
  ): Promise<ImportedTransaction[]> => {
    if (!tenantId) return [];

    let query = supabase
      .from('imported_transactions')
      .select(`
        *,
        banks!imported_transactions_bank_id_fkey(name),
        bank_statement_imports!imported_transactions_import_id_fkey(file_name)
      `)
      .eq('tenant_id', tenantId)
      .order('transaction_date', { ascending: false });

    if (filters?.bankId) {
      query = query.eq('bank_id', filters.bankId);
    }
    if (filters?.importId) {
      query = query.eq('import_id', filters.importId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return (data || []) as ImportedTransaction[];
  }, [tenantId]);

  /**
   * Accept a reconciliation match
   */
  const acceptMatch = useCallback(async (
    transactionId: string,
    matchType: 'expense' | 'invoice',
    matchId: string,
    transactionDate: string,
    bankId: string,
    amount?: number
  ): Promise<boolean> => {
    if (!user || !tenantId) return false;

    setIsLoading(true);
    try {
      // Update imported_transaction
      const { error: txError } = await supabase
        .from('imported_transactions')
        .update({
          status: 'conciliado',
          reconciled_with_type: matchType,
          reconciled_with_id: matchId,
          processed_at: nowBrasilia(),
          processed_by: user.id,
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      // Update the matched record
      if (matchType === 'expense') {
        const { error } = await supabase
          .from('expenses')
          .update({
            status: 'pago',
            paid_at: transactionDate,
            bank_id: bankId,
          })
          .eq('id', matchId);
        if (error) throw error;
      } else if (matchType === 'invoice') {
        // Get the invoice net value to determine total received
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('net_value')
          .eq('id', matchId)
          .single();

        const invoiceNetValue = invoiceData?.net_value || amount || 0;
        const receiptDate = transactionDate.includes('T') ? transactionDate.split('T')[0] : transactionDate;

        // Create invoice_receipt record so it appears in bank statement
        const { error: receiptError } = await supabase
          .from('invoice_receipts')
          .insert({
            tenant_id: tenantId,
            invoice_id: matchId,
            imported_transaction_id: transactionId,
            bank_id: bankId,
            amount: amount || invoiceNetValue,
            receipt_date: receiptDate,
            adjustment_amount: 0,
            created_by: user.id,
          });

        if (receiptError) throw receiptError;

        // Update invoice
        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'recebido',
            receipt_date: receiptDate,
            bank_id: bankId,
            total_received: invoiceNetValue,
          })
          .eq('id', matchId);
        if (error) throw error;
      }

      toast.success('Transação conciliada com sucesso');
      return true;
    } catch (error) {
      console.error('Error accepting match:', error);
      toast.error('Erro ao conciliar transação');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, tenantId]);

  /**
   * Create a new record from transaction
   */
  const createRecord = useCallback(async (
    transactionId: string,
    transactionType: 'credit' | 'debit',
    amount: number,
    transactionDate: string,
    bankId: string,
    categoryId?: string,
    description?: string,
    source?: string
  ): Promise<boolean> => {
    if (!tenantId || !user) return false;

    setIsLoading(true);
    try {
      let createdRecordId: string | null = null;
      let createdRecordType: string;

      if (transactionType === 'debit') {
        // Create expense
        const { data, error } = await supabase
          .from('expenses')
          .insert({
            tenant_id: tenantId,
            category_id: categoryId,
            amount: amount,
            expense_date: toBrasiliaDate(new Date(transactionDate)),
            description: description || 'Despesa importada',
            supplier: source || null,
            status: 'pago',
            paid_at: nowBrasilia(),
            bank_id: bankId,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        createdRecordId = data.id;
        createdRecordType = 'expense';
      } else {
        // Create revenue
        const { data, error } = await supabase
          .from('revenues')
          .insert({
            tenant_id: tenantId,
            bank_id: bankId,
            amount: amount,
            revenue_date: transactionDate.split('T')[0],
            description: description || 'Receita importada',
            source: source || null,
            category_id: categoryId || null,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        createdRecordId = data.id;
        createdRecordType = 'revenue';
      }

      // Update imported_transaction
      const { error: txError } = await supabase
        .from('imported_transactions')
        .update({
          status: 'criado',
          created_record_type: createdRecordType,
          created_record_id: createdRecordId,
          category_id: categoryId || null,
          custom_description: description || null,
          source: source || null,
          processed_at: nowBrasilia(),
          processed_by: user.id,
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      toast.success('Lançamento criado com sucesso');
      return true;
    } catch (error) {
      console.error('Error creating record:', error);
      toast.error('Erro ao criar lançamento');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user]);

  /**
   * Ignore a transaction
   */
  const ignoreTransaction = useCallback(async (transactionId: string): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('imported_transactions')
        .update({
          status: 'ignorado',
          processed_at: nowBrasilia(),
          processed_by: user.id,
        })
        .eq('id', transactionId);

      if (error) throw error;

      toast.success('Transação ignorada');
      return true;
    } catch (error) {
      console.error('Error ignoring transaction:', error);
      toast.error('Erro ao ignorar transação');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Get reconciliation suggestion for a transaction
   */
  const getSuggestion = useCallback(async (
    transaction: ImportedTransaction
  ): Promise<ReconciliationSuggestion | null> => {
    if (!transaction.suggested_match_id || !transaction.suggested_match_type || !tenantId) {
      return null;
    }

    // Fetch the suggested match details - FILTERED BY TENANT
    if (transaction.suggested_match_type === 'expense') {
      const { data } = await supabase
        .from('expenses')
        .select('id, amount, due_date, description, supplier, status')
        .eq('id', transaction.suggested_match_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!data || data.status !== 'pendente') return null;

      return {
        matchType: 'expense',
        matchId: data.id,
        matchDescription: `${data.description}${data.supplier ? ` - ${data.supplier}` : ''}`,
        matchAmount: data.amount,
        matchDate: data.due_date,
        confidence: (transaction.suggested_confidence as 'high' | 'medium' | 'low') || 'low',
      };
    } else if (transaction.suggested_match_type === 'invoice') {
      const { data } = await supabase
        .from('invoices')
        .select('id, net_value, expected_receipt_date, company_name, invoice_number, status')
        .eq('id', transaction.suggested_match_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!data || data.status !== 'pendente') return null;

      return {
        matchType: 'invoice',
        matchId: data.id,
        matchDescription: `NF ${data.invoice_number} - ${data.company_name}`,
        matchAmount: data.net_value,
        matchDate: data.expected_receipt_date,
        confidence: (transaction.suggested_confidence as 'high' | 'medium' | 'low') || 'low',
      };
    }

    return null;
  }, [tenantId]);

  /**
   * Accept a reconciliation match with accounts_payable (for debits)
   * Creates a payment record and updates payable status
   */
  const acceptPayableMatch = useCallback(async (
    transactionId: string,
    payableId: string,
    amount: number,
    transactionDate: string,
    bankId: string
  ): Promise<boolean> => {
    if (!user || !tenantId) return false;

    setIsLoading(true);
    try {
      // 1. Fetch current payable state
      const { data: payable, error: payableError } = await supabase
        .from('accounts_payable')
        .select('amount_to_pay, status')
        .eq('id', payableId)
        .single();

      if (payableError || !payable) throw payableError || new Error('Lançamento não encontrado');

      // Fetch existing non-reversed payments
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('account_payable_id', payableId)
        .is('reversed_at', null);

      const totalPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const newTotalPaid = totalPaid + amount;
      const isFullyPaid = Math.abs(newTotalPaid - Number(payable.amount_to_pay)) < 0.01;

      // 2. Insert payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        account_payable_id: payableId,
        bank_id: bankId,
        amount: amount,
        payment_date: transactionDate.includes('T') ? transactionDate.split('T')[0] : transactionDate,
        tenant_id: tenantId,
        notes: 'Pagamento via conciliação bancária',
      });

      if (paymentError) throw paymentError;

      // 3. Update payable status
      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          status: isFullyPaid ? 'pago' : 'parcialmente_pago',
          paid_at: isFullyPaid ? nowBrasilia() : null,
        })
        .eq('id', payableId);

      if (updateError) throw updateError;

      // 4. Mark transaction as reconciled
      const { error: txError } = await supabase
        .from('imported_transactions')
        .update({
          status: 'conciliado',
          reconciled_with_type: 'payable',
          reconciled_with_id: payableId,
          processed_at: nowBrasilia(),
          processed_by: user.id,
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      toast.success('Pagamento registrado via conciliação');
      return true;
    } catch (error) {
      console.error('Error accepting payable match:', error);
      toast.error('Erro ao registrar pagamento');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, tenantId]);

  /**
   * Reverse a reconciled or created transaction
   */
  const reverseReconciliation = useCallback(async (
    transaction: ImportedTransaction,
    reason: string
  ): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      // Handle based on status
      if (transaction.status === 'conciliado') {
        // Reverse the linked record
        if (transaction.reconciled_with_type === 'expense') {
          // Reset expense to pending
          const { error } = await supabase
            .from('expenses')
            .update({
              status: 'pendente',
              bank_id: null,
              paid_at: null,
              notes: `[ESTORNO CONCILIAÇÃO] ${reason}`,
            })
            .eq('id', transaction.reconciled_with_id);
          if (error) throw error;
        } else if (transaction.reconciled_with_type === 'invoice') {
          // Find and reverse the most recent active receipt for this transaction
          const { data: receipt, error: findReceiptError } = await supabase
            .from('invoice_receipts')
            .select('id, amount, invoice_id')
            .eq('imported_transaction_id', transaction.id)
            .is('reversed_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (findReceiptError) throw findReceiptError;

          if (receipt) {
            // Mark receipt as reversed
            const { error: reverseReceiptError } = await supabase
              .from('invoice_receipts')
              .update({
                reversed_at: nowBrasilia(),
                reversed_by: user.id,
                reversal_reason: `[ESTORNO CONCILIAÇÃO] ${reason}`,
              })
              .eq('id', receipt.id);

            if (reverseReceiptError) throw reverseReceiptError;

            // Recalculate invoice total_received and status
            const { data: remainingReceipts } = await supabase
              .from('invoice_receipts')
              .select('amount')
              .eq('invoice_id', receipt.invoice_id)
              .is('reversed_at', null);

            const { data: invoiceData } = await supabase
              .from('invoices')
              .select('net_value')
              .eq('id', receipt.invoice_id)
              .single();

            const newTotalReceived = (remainingReceipts || []).reduce((sum, r) => sum + Number(r.amount), 0);
            const netValue = Number(invoiceData?.net_value || 0);
            
            let newStatus: 'pendente' | 'parcialmente_recebido' | 'recebido' = 'pendente';
            if (newTotalReceived > 0) {
              newStatus = Math.abs(newTotalReceived - netValue) < 0.01 || newTotalReceived >= netValue
                ? 'recebido'
                : 'parcialmente_recebido';
            }

            const { error: invoiceUpdateError } = await supabase
              .from('invoices')
              .update({
                status: newStatus,
                total_received: newTotalReceived,
                receipt_date: newStatus === 'recebido' ? todayBrasilia() : null,
                bank_id: newStatus === 'pendente' ? null : undefined,
              })
              .eq('id', receipt.invoice_id);

            if (invoiceUpdateError) throw invoiceUpdateError;
          } else {
            // Fallback: if no receipt found, just reset invoice (legacy behavior)
            const { error } = await supabase
              .from('invoices')
              .update({
                status: 'pendente',
                bank_id: null,
                receipt_date: null,
                total_received: 0,
              })
              .eq('id', transaction.reconciled_with_id);
            if (error) throw error;
          }
        } else if (transaction.reconciled_with_type === 'payable') {
          // Reverse the most recent active payment
          const { data: payment, error: findError } = await supabase
            .from('payments')
            .select('id, amount, account_payable_id')
            .eq('account_payable_id', transaction.reconciled_with_id)
            .is('reversed_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (findError && findError.code !== 'PGRST116') throw findError;

          if (payment) {
            // Mark payment as reversed
            const { error: reverseError } = await supabase
              .from('payments')
              .update({
                reversed_at: nowBrasilia(),
                reversed_by: user.id,
                reversal_reason: `[ESTORNO CONCILIAÇÃO] ${reason}`,
              })
              .eq('id', payment.id);

            if (reverseError) throw reverseError;

            // Recalculate payable status
            const { data: remainingPayments } = await supabase
              .from('payments')
              .select('amount')
              .eq('account_payable_id', payment.account_payable_id)
              .is('reversed_at', null);

            const { data: payable } = await supabase
              .from('accounts_payable')
              .select('amount_to_pay')
              .eq('id', payment.account_payable_id)
              .single();

            const totalPaid = (remainingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            let newStatus: 'pendente' | 'parcialmente_pago' | 'pago' = 'pendente';
            if (totalPaid > 0 && payable) {
              newStatus = Math.abs(totalPaid - Number(payable.amount_to_pay)) < 0.01 ? 'pago' : 'parcialmente_pago';
            }

            const { error: statusError } = await supabase
              .from('accounts_payable')
              .update({
                status: newStatus,
                paid_at: newStatus === 'pago' ? nowBrasilia() : null,
              })
              .eq('id', payment.account_payable_id);

            if (statusError) throw statusError;
          }
        }
      } else if (transaction.status === 'criado') {
        // Delete the created record
        if (transaction.created_record_type === 'expense') {
          const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', transaction.created_record_id);
          if (error) throw error;
        } else if (transaction.created_record_type === 'revenue') {
          const { error } = await supabase
            .from('revenues')
            .delete()
            .eq('id', transaction.created_record_id);
          if (error) throw error;
        }
      }

      // Reset imported_transaction to pending
      const { error: resetError } = await supabase
        .from('imported_transactions')
        .update({
          status: 'pendente',
          reconciled_with_type: null,
          reconciled_with_id: null,
          created_record_type: null,
          created_record_id: null,
          category_id: null,
          custom_description: null,
          source: null,
          processed_at: null,
          processed_by: null,
        })
        .eq('id', transaction.id);

      if (resetError) throw resetError;

      toast.success('Conciliação estornada com sucesso');
      return true;
    } catch (error) {
      console.error('Error reversing reconciliation:', error);
      toast.error('Erro ao estornar conciliação');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Accept an invoice match with optional adjustment (for credits with value differences)
   * Now supports partial receipts
   */
  const acceptInvoiceWithAdjustment = useCallback(async (
    transactionId: string,
    invoiceId: string,
    invoiceNetValue: number,
    receivedAmount: number,
    transactionDate: string,
    bankId: string,
    adjustmentReason?: string,
    adjustmentNotes?: string
  ): Promise<boolean> => {
    if (!user || !tenantId) return false;

    setIsLoading(true);
    try {
      // 1. Fetch previous receipts (not reversed) to calculate total received
      const { data: previousReceipts } = await supabase
        .from('invoice_receipts')
        .select('amount')
        .eq('invoice_id', invoiceId)
        .is('reversed_at', null);

      const totalPreviouslyReceived = (previousReceipts || [])
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const newTotalReceived = totalPreviouslyReceived + receivedAmount;
      const pendingBalance = invoiceNetValue - totalPreviouslyReceived;
      const isFullyReceived = Math.abs(newTotalReceived - invoiceNetValue) < 0.01 
                              || newTotalReceived >= invoiceNetValue;

      // 2. Calculate adjustment (difference between received and pending balance)
      const adjustmentAmount = receivedAmount - pendingBalance;
      const hasAdjustment = Math.abs(adjustmentAmount) >= 0.01 && adjustmentReason;

      // 3. Create invoice_receipt record
      const { error: receiptError } = await supabase
        .from('invoice_receipts')
        .insert({
          tenant_id: tenantId,
          invoice_id: invoiceId,
          imported_transaction_id: transactionId,
          bank_id: bankId,
          amount: receivedAmount,
          receipt_date: transactionDate.includes('T') ? transactionDate.split('T')[0] : transactionDate,
          adjustment_amount: hasAdjustment ? adjustmentAmount : 0,
          adjustment_reason: hasAdjustment ? adjustmentReason : null,
          notes: adjustmentNotes || null,
          created_by: user.id,
        });

      if (receiptError) throw receiptError;

      // 4. If there's an adjustment, also create receipt_payment_adjustments record
      if (hasAdjustment) {
        const { error: adjustmentError } = await supabase
          .from('receipt_payment_adjustments')
          .insert({
            tenant_id: tenantId,
            adjustment_type: 'recebimento',
            invoice_id: invoiceId,
            imported_transaction_id: transactionId,
            bank_id: bankId,
            expected_amount: pendingBalance,
            received_amount: receivedAmount,
            adjustment_amount: adjustmentAmount,
            adjustment_date: transactionDate.includes('T') ? transactionDate.split('T')[0] : transactionDate,
            reason: adjustmentReason,
            notes: adjustmentNotes || null,
            created_by: user.id,
          });

        if (adjustmentError) throw adjustmentError;
      }

      // 5. Update the invoice with new status and total_received
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: isFullyReceived ? 'recebido' : 'parcialmente_recebido',
          receipt_date: isFullyReceived ? (transactionDate.includes('T') ? transactionDate.split('T')[0] : transactionDate) : null,
          bank_id: bankId,
          total_received: newTotalReceived,
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // 6. Update imported_transaction
      const { error: txError } = await supabase
        .from('imported_transactions')
        .update({
          status: 'conciliado',
          reconciled_with_type: 'invoice',
          reconciled_with_id: invoiceId,
          processed_at: nowBrasilia(),
          processed_by: user.id,
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      const statusMsg = isFullyReceived 
        ? 'Nota fiscal totalmente recebida' 
        : 'Recebimento parcial registrado';
      toast.success(hasAdjustment ? `${statusMsg} (com ajuste)` : statusMsg);
      return true;
    } catch (error) {
      console.error('Error accepting invoice with adjustment:', error);
      toast.error('Erro ao conciliar transação');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, tenantId]);

  /**
   * Accept multiple invoices with a single transaction (multi-allocation)
   * Supports total and partial payments across multiple invoices
   */
  const acceptMultipleInvoicesWithAdjustment = useCallback(async (
    transactionId: string,
    invoices: Array<{ invoiceId: string; allocatedAmount: number }>,
    totalReceivedAmount: number,
    transactionDate: string,
    bankId: string,
    adjustmentReason?: string,
    adjustmentNotes?: string
  ): Promise<boolean> => {
    if (!user || !tenantId) return false;
    if (invoices.length === 0) return false;

    setIsLoading(true);
    try {
      const receiptDate = transactionDate.includes('T') ? transactionDate.split('T')[0] : transactionDate;
      const totalAllocated = invoices.reduce((sum, inv) => sum + inv.allocatedAmount, 0);
      const adjustmentAmount = totalReceivedAmount - totalAllocated;
      const hasAdjustment = Math.abs(adjustmentAmount) >= 0.01 && adjustmentReason;

      // Process each invoice
      for (const { invoiceId, allocatedAmount } of invoices) {
        // 1. Fetch previous receipts to calculate total received
        const { data: previousReceipts } = await supabase
          .from('invoice_receipts')
          .select('amount')
          .eq('invoice_id', invoiceId)
          .is('reversed_at', null);

        const totalPreviouslyReceived = (previousReceipts || [])
          .reduce((sum, r) => sum + Number(r.amount), 0);

        // 2. Fetch invoice net value
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('net_value')
          .eq('id', invoiceId)
          .single();

        const invoiceNetValue = Number(invoiceData?.net_value || 0);
        const newTotalReceived = totalPreviouslyReceived + allocatedAmount;
        const isFullyReceived = Math.abs(newTotalReceived - invoiceNetValue) < 0.01 
                                || newTotalReceived >= invoiceNetValue;

        // 3. Create invoice_receipt record
        const { error: receiptError } = await supabase
          .from('invoice_receipts')
          .insert({
            tenant_id: tenantId,
            invoice_id: invoiceId,
            imported_transaction_id: transactionId,
            bank_id: bankId,
            amount: allocatedAmount,
            receipt_date: receiptDate,
            adjustment_amount: 0, // Individual receipts don't have adjustment
            adjustment_reason: null,
            notes: invoices.length > 1 
              ? `Recebimento múltiplo (${invoices.length} notas)` 
              : null,
            created_by: user.id,
          });

        if (receiptError) throw receiptError;

        // 4. Update the invoice with new status and total_received
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            status: isFullyReceived ? 'recebido' : 'parcialmente_recebido',
            receipt_date: isFullyReceived ? receiptDate : null,
            bank_id: bankId,
            total_received: newTotalReceived,
          })
          .eq('id', invoiceId);

        if (invoiceError) throw invoiceError;
      }

      // 5. If there's an adjustment, create receipt_payment_adjustments record
      if (hasAdjustment) {
        const { error: adjustmentError } = await supabase
          .from('receipt_payment_adjustments')
          .insert({
            tenant_id: tenantId,
            adjustment_type: 'recebimento',
            invoice_id: invoices[0].invoiceId, // Link to first invoice
            imported_transaction_id: transactionId,
            bank_id: bankId,
            expected_amount: totalAllocated,
            received_amount: totalReceivedAmount,
            adjustment_amount: adjustmentAmount,
            adjustment_date: receiptDate,
            reason: adjustmentReason,
            notes: adjustmentNotes 
              ? `${adjustmentNotes} (${invoices.length} notas vinculadas)`
              : `${invoices.length} notas vinculadas`,
            created_by: user.id,
          });

        if (adjustmentError) throw adjustmentError;
      }

      // 6. Update imported_transaction
      const { error: txError } = await supabase
        .from('imported_transactions')
        .update({
          status: 'conciliado',
          reconciled_with_type: 'invoice',
          reconciled_with_id: invoices[0].invoiceId, // Link to first invoice
          processed_at: nowBrasilia(),
          processed_by: user.id,
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      const statusMsg = invoices.length === 1 
        ? 'Nota fiscal vinculada'
        : `${invoices.length} notas fiscais vinculadas`;
      toast.success(hasAdjustment ? `${statusMsg} (com ajuste)` : statusMsg);
      return true;
    } catch (error) {
      console.error('Error accepting multiple invoices:', error);
      toast.error('Erro ao vincular notas fiscais');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, tenantId]);

  /**
   * Fetch receipt info for an invoice (for displaying in UI)
   */
  const getInvoiceReceiptInfo = useCallback(async (invoiceId: string): Promise<{
    totalReceived: number;
    receiptsCount: number;
  }> => {
    const { data: receipts } = await supabase
      .from('invoice_receipts')
      .select('amount')
      .eq('invoice_id', invoiceId)
      .is('reversed_at', null);

    const totalReceived = (receipts || []).reduce((sum, r) => sum + Number(r.amount), 0);
    return {
      totalReceived,
      receiptsCount: receipts?.length || 0,
    };
  }, []);

  return {
    isLoading,
    importOFXTransactions,
    fetchPendingTransactions,
    acceptMatch,
    acceptPayableMatch,
    acceptInvoiceWithAdjustment,
    acceptMultipleInvoicesWithAdjustment,
    getInvoiceReceiptInfo,
    createRecord,
    ignoreTransaction,
    getSuggestion,
    reverseReconciliation,
  };
}

// Helper function to find best match
function findBestMatch(
  transaction: OFXTransaction,
  expenses: PendingExpense[],
  invoices: PendingInvoice[]
): ReconciliationSuggestion | null {
  if (transaction.type === 'debit') {
    for (const expense of expenses) {
      const amountDiff = Math.abs(expense.amount - transaction.amount);
      const isExactMatch = amountDiff < 0.01;
      
      if (isExactMatch) {
        const dateDiff = expense.due_date 
          ? Math.abs(new Date(expense.due_date).getTime() - transaction.date.getTime()) / (1000 * 60 * 60 * 24)
          : 999;
        
        const confidence = dateDiff <= 5 ? 'high' : dateDiff <= 15 ? 'medium' : 'low';
        
        return {
          matchType: 'expense',
          matchId: expense.id,
          matchDescription: `${expense.description}${expense.supplier ? ` - ${expense.supplier}` : ''}`,
          matchAmount: expense.amount,
          matchDate: expense.due_date,
          confidence,
        };
      }
    }
  } else {
    for (const invoice of invoices) {
      const amountDiff = Math.abs(invoice.net_value - transaction.amount);
      const isExactMatch = amountDiff < 0.01;
      
      if (isExactMatch) {
        const dateDiff = Math.abs(new Date(invoice.expected_receipt_date).getTime() - transaction.date.getTime()) / (1000 * 60 * 60 * 24);
        
        const confidence = dateDiff <= 5 ? 'high' : dateDiff <= 15 ? 'medium' : 'low';
        
        return {
          matchType: 'invoice',
          matchId: invoice.id,
          matchDescription: `NF ${invoice.invoice_number} - ${invoice.company_name}`,
          matchAmount: invoice.net_value,
          matchDate: invoice.expected_receipt_date,
          confidence,
        };
      }
    }
  }

  return null;
}
