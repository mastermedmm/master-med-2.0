import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { OFXTransaction } from '@/utils/parseOFX';
import { toast } from 'sonner';
import { toBrasiliaISO, toBrasiliaDate } from '@/lib/utils';

export interface ReconciliationMatch {
  transaction: OFXTransaction;
  matchType: 'expense' | 'payment' | 'invoice' | null;
  matchId: string | null;
  matchDescription: string | null;
  matchAmount: number | null;
  matchDate: Date | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface TransactionClassification {
  transactionId: string;
  action: 'reconcile' | 'create' | 'ignore';
  matchId?: string;
  matchType?: 'expense' | 'payment' | 'invoice';
  categoryId?: string;
  description?: string;
  source?: string;
}

interface PendingExpense {
  id: string;
  amount: number;
  due_date: string | null;
  description: string;
  supplier: string | null;
}

interface PendingPayment {
  id: string;
  amount: number;
  accounts_payable: {
    id: string;
    doctors: { name: string };
  };
}

interface PendingInvoice {
  id: string;
  net_value: number;
  expected_receipt_date: string;
  company_name: string;
  invoice_number: string;
}

export function useBankStatementImport() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Find potential matches for transactions (reconciliation suggestions)
   */
  const findMatches = useCallback(async (
    transactions: OFXTransaction[],
    bankId: string
  ): Promise<ReconciliationMatch[]> => {
    if (!tenantId) return transactions.map(t => ({
      transaction: t,
      matchType: null,
      matchId: null,
      matchDescription: null,
      matchAmount: null,
      matchDate: null,
      confidence: 'low' as const,
    }));

    setIsLoading(true);
    
    try {
      // Fetch pending expenses
      const { data: pendingExpenses } = await supabase
        .from('expenses')
        .select('id, amount, due_date, description, supplier')
        .eq('status', 'pendente')
        .is('bank_id', null) as { data: PendingExpense[] | null };

      // Fetch pending payments (accounts payable that are pending)
      // Note: This could be used for more advanced matching in the future
      const { data: _pendingPayments } = await supabase
        .from('payments')
        .select('id, amount, accounts_payable(id, doctors(name))')
        .eq('bank_id', bankId)
        .is('reversed_at', null) as { data: PendingPayment[] | null };

      // Fetch pending invoices (for credit matching)
      const { data: pendingInvoices } = await supabase
        .from('invoices')
        .select('id, net_value, expected_receipt_date, company_name, invoice_number')
        .eq('status', 'pendente') as { data: PendingInvoice[] | null };

      // Check for already imported transactions
      const { data: existingExpenses } = await supabase
        .from('expenses')
        .select('external_id')
        .not('external_id', 'is', null);
      
      const { data: existingRevenues } = await supabase
        .from('revenues')
        .select('external_id')
        .not('external_id', 'is', null);

      const existingIds = new Set([
        ...(existingExpenses || []).map(e => e.external_id),
        ...(existingRevenues || []).map(r => r.external_id),
      ]);

      const matches: ReconciliationMatch[] = transactions.map(transaction => {
        // Skip if already imported
        if (existingIds.has(transaction.id)) {
          return {
            transaction,
            matchType: null,
            matchId: 'ALREADY_IMPORTED',
            matchDescription: 'Transação já importada anteriormente',
            matchAmount: null,
            matchDate: null,
            confidence: 'high' as const,
          };
        }

        let bestMatch: ReconciliationMatch = {
          transaction,
          matchType: null,
          matchId: null,
          matchDescription: null,
          matchAmount: null,
          matchDate: null,
          confidence: 'low' as const,
        };

        if (transaction.type === 'debit') {
          // Try to match with pending expenses
          for (const expense of pendingExpenses || []) {
            const amountDiff = Math.abs(expense.amount - transaction.amount);
            const isExactMatch = amountDiff < 0.01;
            const isCloseMatch = amountDiff / transaction.amount < 0.05; // Within 5%
            
            if (isExactMatch || isCloseMatch) {
              const dateDiff = expense.due_date 
                ? Math.abs(new Date(expense.due_date).getTime() - transaction.date.getTime()) / (1000 * 60 * 60 * 24)
                : 999;
              
              const confidence = isExactMatch && dateDiff <= 5 ? 'high' 
                : isExactMatch ? 'medium' 
                : 'low';
              
              if (confidence === 'high' || (confidence === 'medium' && bestMatch.confidence !== 'high')) {
                bestMatch = {
                  transaction,
                  matchType: 'expense',
                  matchId: expense.id,
                  matchDescription: `${expense.description}${expense.supplier ? ` - ${expense.supplier}` : ''}`,
                  matchAmount: expense.amount,
                  matchDate: expense.due_date ? new Date(expense.due_date) : null,
                  confidence,
                };
              }
            }
          }
        } else {
          // Credit - try to match with pending invoices
          for (const invoice of pendingInvoices || []) {
            const amountDiff = Math.abs(invoice.net_value - transaction.amount);
            const isExactMatch = amountDiff < 0.01;
            const isCloseMatch = amountDiff / transaction.amount < 0.05;
            
            if (isExactMatch || isCloseMatch) {
              const dateDiff = Math.abs(new Date(invoice.expected_receipt_date).getTime() - transaction.date.getTime()) / (1000 * 60 * 60 * 24);
              
              const confidence = isExactMatch && dateDiff <= 5 ? 'high' 
                : isExactMatch ? 'medium' 
                : 'low';
              
              if (confidence === 'high' || (confidence === 'medium' && bestMatch.confidence !== 'high')) {
                bestMatch = {
                  transaction,
                  matchType: 'invoice',
                  matchId: invoice.id,
                  matchDescription: `NF ${invoice.invoice_number} - ${invoice.company_name}`,
                  matchAmount: invoice.net_value,
                  matchDate: new Date(invoice.expected_receipt_date),
                  confidence,
                };
              }
            }
          }
        }

        return bestMatch;
      });

      return matches;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Import transactions based on user classifications
   */
  const importTransactions = useCallback(async (
    classifications: TransactionClassification[],
    transactions: OFXTransaction[],
    bankId: string,
    fileName: string,
    fileHash: string
  ): Promise<{ success: boolean; imported: number; reconciled: number; ignored: number }> => {
    if (!tenantId || !user) {
      toast.error('Erro de contexto: tenant ou usuário não disponível');
      return { success: false, imported: 0, reconciled: 0, ignored: 0 };
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
          transaction_count: classifications.filter(c => c.action !== 'ignore').length,
          imported_by: user.id,
        })
        .select('id')
        .single();

      if (importError) {
        console.error('Error creating import record:', importError);
        toast.error('Erro ao registrar importação');
        return { success: false, imported: 0, reconciled: 0, ignored: 0 };
      }

      let imported = 0;
      let reconciled = 0;
      let ignored = 0;

      for (const classification of classifications) {
        const transaction = transactions.find(t => t.id === classification.transactionId);
        if (!transaction) continue;

        if (classification.action === 'ignore') {
          ignored++;
          continue;
        }

        if (classification.action === 'reconcile' && classification.matchType === 'expense' && classification.matchId) {
          // Mark expense as paid
          const { error } = await supabase
            .from('expenses')
            .update({
              status: 'pago',
              paid_at: toBrasiliaISO(transaction.date),
              bank_id: bankId,
              external_id: transaction.id,
              statement_import_id: importRecord.id,
            })
            .eq('id', classification.matchId);

          if (!error) reconciled++;
          continue;
        }

        if (classification.action === 'reconcile' && classification.matchType === 'invoice' && classification.matchId) {
          // Get invoice net value
          const { data: invoiceData } = await supabase
            .from('invoices')
            .select('net_value')
            .eq('id', classification.matchId)
            .single();

          const invoiceNetValue = invoiceData?.net_value || transaction.amount;
          const receiptDate = toBrasiliaDate(transaction.date);

          // Create invoice_receipt record so it appears in bank statement
          const { error: receiptError } = await supabase
            .from('invoice_receipts')
            .insert({
              tenant_id: tenantId,
              invoice_id: classification.matchId,
              bank_id: bankId,
              amount: transaction.amount,
              receipt_date: receiptDate,
              adjustment_amount: 0,
              created_by: user.id,
            });

          if (receiptError) {
            console.error('Error creating invoice receipt:', receiptError);
          }

          // Mark invoice as received
          const { error } = await supabase
            .from('invoices')
            .update({
              status: 'recebido',
              receipt_date: receiptDate,
              bank_id: bankId,
              total_received: invoiceNetValue,
            })
            .eq('id', classification.matchId);

          if (!error) reconciled++;
          continue;
        }

        // Create new transaction
        if (classification.action === 'create') {
          if (transaction.type === 'debit') {
            // Create expense
            const { error } = await supabase
              .from('expenses')
              .insert({
                tenant_id: tenantId,
                category_id: classification.categoryId,
                amount: transaction.amount,
                expense_date: toBrasiliaDate(transaction.date),
                description: classification.description || transaction.description,
                supplier: classification.source || null,
                status: 'pago',
                paid_at: toBrasiliaISO(transaction.date),
                bank_id: bankId,
                external_id: transaction.id,
                statement_import_id: importRecord.id,
                created_by: user.id,
              });

            if (!error) imported++;
          } else {
            // Create revenue
            const { error } = await supabase
              .from('revenues')
              .insert({
                tenant_id: tenantId,
                bank_id: bankId,
                amount: transaction.amount,
                revenue_date: toBrasiliaDate(transaction.date),
                description: classification.description || transaction.description,
                source: classification.source || null,
                external_id: transaction.id,
                statement_import_id: importRecord.id,
                created_by: user.id,
              });

            if (!error) imported++;
          }
        }
      }

      toast.success(`Importação concluída: ${imported} criados, ${reconciled} conciliados, ${ignored} ignorados`);
      return { success: true, imported, reconciled, ignored };
    } catch (error) {
      console.error('Error importing transactions:', error);
      toast.error('Erro ao importar transações');
      return { success: false, imported: 0, reconciled: 0, ignored: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user]);

  /**
   * Check if file was already imported
   */
  const checkDuplicateImport = useCallback(async (
    fileHash: string,
    bankId: string
  ): Promise<boolean> => {
    const { data } = await supabase
      .from('bank_statement_imports')
      .select('id')
      .eq('file_hash', fileHash)
      .eq('bank_id', bankId)
      .limit(1);

    return (data?.length || 0) > 0;
  }, []);

  return {
    isLoading,
    findMatches,
    importTransactions,
    checkDuplicateImport,
  };
}
