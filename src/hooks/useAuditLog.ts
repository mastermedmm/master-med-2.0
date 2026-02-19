import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AuditLogParams {
  action: AuditAction;
  tableName: string;
  recordId: string;
  recordLabel?: string;
  oldData?: object | null;
  newData?: object | null;
}

interface UseAuditLogReturn {
  logEvent: (params: AuditLogParams) => Promise<void>;
}

// Helper function to get changed fields between two objects
function getChangedFields(
  oldData: object | null | undefined,
  newData: object | null | undefined
): string[] {
  if (!oldData || !newData) return [];
  
  const changedFields: string[] = [];
  const oldObj = oldData as Record<string, unknown>;
  const newObj = newData as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  
  for (const key of allKeys) {
    // Skip metadata fields
    if (['created_at', 'updated_at', 'tenant_id'].includes(key)) continue;
    
    const oldValue = JSON.stringify(oldObj[key]);
    const newValue = JSON.stringify(newObj[key]);
    
    if (oldValue !== newValue) {
      changedFields.push(key);
    }
  }
  
  return changedFields;
}

export function useAuditLog(): UseAuditLogReturn {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  // Fetch user profile for name
  const { data: profile } = useQuery({
    queryKey: ['user-profile-for-audit', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const logEvent = useCallback(async (params: AuditLogParams) => {
    if (!user || !tenantId) {
      console.warn('Cannot log audit event: missing user or tenant');
      return;
    }

    const { action, tableName, recordId, recordLabel, oldData, newData } = params;

    try {
      const changedFields = action === 'UPDATE' 
        ? getChangedFields(oldData, newData) 
        : null;

      // Clean sensitive data before logging
      const cleanData = (data: object | null | undefined): Record<string, unknown> | null => {
        if (!data) return null;
        const cleaned = { ...(data as Record<string, unknown>) };
        // Remove sensitive fields
        delete cleaned.portal_password_hash;
        delete cleaned.password;
        return cleaned;
      };

      // Use type assertion since types.ts may not be updated yet with new table
      const insertData = {
        tenant_id: tenantId,
        user_id: user.id,
        user_name: profile?.full_name || user.email || 'Usuário desconhecido',
        action,
        table_name: tableName,
        record_id: recordId,
        record_label: recordLabel || null,
        old_data: cleanData(oldData),
        new_data: cleanData(newData),
        changed_fields: changedFields,
      };
      
      const { error } = await supabase
        .from('audit_logs')
        .insert(insertData as never);

      if (error) {
        console.error('Error logging audit event:', error);
      }
    } catch (err) {
      console.error('Failed to log audit event:', err);
    }
  }, [user, profile, tenantId]);

  return { logEvent };
}

// Table name translations for display
export const TABLE_LABELS: Record<string, string> = {
  doctors: 'Médicos',
  hospitals: 'Hospitais',
  banks: 'Bancos',
  issuers: 'Emitentes',
  invoices: 'Notas Fiscais',
  invoice_allocations: 'Rateios',
  accounts_payable: 'Lançamentos',
  expenses: 'Despesas',
  expense_categories: 'Categorias de Despesa',
  expense_groups: 'Grupos de Despesa',
  revenue_categories: 'Categorias de Receita',
  revenue_groups: 'Grupos de Receita',
  revenues: 'Receitas',
  users: 'Usuários',
  profiles: 'Perfis',
  user_roles: 'Papéis de Usuário',
  module_permissions: 'Permissões',
  imported_transactions: 'Transações Importadas',
  invoice_receipts: 'Recebimentos',
  payments: 'Pagamentos',
  system_settings: 'Configurações',
};

// Action translations for display
export const ACTION_LABELS: Record<AuditAction, string> = {
  INSERT: 'Criou',
  UPDATE: 'Editou',
  DELETE: 'Excluiu',
};

// Action colors for badges
export const ACTION_COLORS: Record<AuditAction, string> = {
  INSERT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

// Field name translations for display
export const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  cpf: 'CPF',
  crm: 'CRM',
  phone: 'Telefone',
  email: 'E-mail',
  address: 'Endereço',
  city: 'Cidade',
  state: 'Estado',
  zip_code: 'CEP',
  neighborhood: 'Bairro',
  bank_name: 'Banco',
  bank_agency: 'Agência',
  bank_account: 'Conta',
  pix_key: 'Chave PIX',
  aliquota: 'Alíquota',
  is_freelancer: 'Autônomo',
  linked_company: 'Empresa Vinculada',
  linked_company_2: 'Empresa Vinculada 2',
  document: 'CNPJ/CPF',
  cnpj: 'CNPJ',
  payer_cnpj_1: 'CNPJ Pagador 1',
  payer_cnpj_2: 'CNPJ Pagador 2',
  initial_balance: 'Saldo Inicial',
  agency: 'Agência',
  account_number: 'Número da Conta',
  iss_rate: 'Taxa ISS',
  active: 'Ativo',
  description: 'Descrição',
  amount: 'Valor',
  status: 'Status',
  role: 'Papel',
  full_name: 'Nome Completo',
  birth_date: 'Data de Nascimento',
  certificate_expires_at: 'Validade do Certificado',
};
