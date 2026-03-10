import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export type RTEventType = 
  | 'criacao'
  | 'edicao'
  | 'alteracao_validade'
  | 'alteracao_status'
  | 'encerramento';

const EVENT_LABELS: Record<RTEventType, string> = {
  criacao: 'Criação',
  edicao: 'Edição',
  alteracao_validade: 'Alteração de validade',
  alteracao_status: 'Alteração de status',
  encerramento: 'Encerramento',
};

export interface RTHistoryEvent {
  id: string;
  vinculo_rt_id: string;
  tipo_evento: string;
  descricao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
  tenant_id: string | null;
}

export function useRTHistoryEvents(vinculoId: string | undefined) {
  return useQuery({
    queryKey: ['historico_vinculos_rt', vinculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_vinculos_rt' as any)
        .select('*')
        .eq('vinculo_rt_id', vinculoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as RTHistoryEvent[];
    },
    enabled: !!vinculoId,
  });
}

export function useRTHistoryLogger() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  // Fetch user profile name
  const { data: profile } = useQuery({
    queryKey: ['user-profile-for-rt-history', user?.id],
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

  const logEvent = useCallback(async (params: {
    vinculoRtId: string;
    tipoEvento: RTEventType;
    descricao: string;
    dadosAnteriores?: Record<string, unknown> | null;
    dadosNovos?: Record<string, unknown> | null;
  }) => {
    if (!user || !tenantId) return;

    try {
      await supabase
        .from('historico_vinculos_rt' as any)
        .insert({
          vinculo_rt_id: params.vinculoRtId,
          tipo_evento: params.tipoEvento,
          descricao: params.descricao,
          usuario_id: user.id,
          usuario_nome: profile?.full_name || user.email || 'Desconhecido',
          dados_anteriores: params.dadosAnteriores || null,
          dados_novos: params.dadosNovos || null,
          tenant_id: tenantId,
        } as any);
    } catch (err) {
      console.error('Failed to log RT history event:', err);
    }
  }, [user, profile, tenantId]);

  return { logEvent };
}

export { EVENT_LABELS };
