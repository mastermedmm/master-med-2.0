import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  logId: string;
  imported: number;
  skipped: number;
  updated: number;
  failed: number;
  totalFound: number;
  errors: string[];
}

interface SyncParams {
  cnpjEmit?: string;
  dataEmissaoInicio: string;
  dataEmissaoFim: string;
  updateMode?: boolean;
}

interface SiegSyncLog {
  id: string;
  tenant_id: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: string;
  total_xmls_found: number;
  xmls_imported: number;
  xmls_skipped: number;
  xmls_updated: number;
  xmls_failed: number;
  error_message: string | null;
  filter_cnpj_emit: string | null;
  filter_date_start: string | null;
  filter_date_end: string | null;
  created_by: string | null;
  created_at: string;
}

export function useSiegSync() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  // Fetch SIEG API key status
  const { data: siegConfig, isLoading: isLoadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['sieg-config', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('tenant_id', tenantId)
        .in('key', ['sieg_api_key', 'sieg_enabled', 'sieg_last_sync', 'sieg_webservice_url']);

      if (error) throw error;

      const config: Record<string, string | null> = {};
      data?.forEach(row => {
        config[row.key] = row.value;
      });

      const defaultWebServiceUrl = 'https://api.sieg.com/BaixarXmls';

      return {
        hasApiKey: !!config.sieg_api_key,
        isEnabled: config.sieg_enabled === 'true',
        lastSync: config.sieg_last_sync || null,
        webServiceUrl: (config.sieg_webservice_url || defaultWebServiceUrl).trim(),
      };
    },
    enabled: !!tenantId,
  });

  // Fetch sync history
  const { data: syncHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['sieg-sync-history', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('sieg_sync_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sync_started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SiegSyncLog[];
    },
    enabled: !!tenantId,
  });

  // Save API key
  const saveApiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!tenantId) throw new Error('Tenant não selecionado');

      // Upsert API key
      const { error: keyError } = await supabase
        .from('system_settings')
        .upsert({
          tenant_id: tenantId,
          key: 'sieg_api_key',
          value: apiKey,
          description: 'API Key do SIEG para download automático de XMLs',
        }, { onConflict: 'tenant_id,key' });

      if (keyError) throw keyError;

      // Enable SIEG integration
      const { error: enableError } = await supabase
        .from('system_settings')
        .upsert({
          tenant_id: tenantId,
          key: 'sieg_enabled',
          value: 'true',
        }, { onConflict: 'tenant_id,key' });

      if (enableError) throw enableError;

      return true;
    },
    onSuccess: () => {
      toast({
        title: 'API Key salva',
        description: 'A integração com o SIEG foi configurada com sucesso.',
      });
      refetchConfig();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar a API Key',
        variant: 'destructive',
      });
    },
  });

  // Remove API key
  const removeApiKeyMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant não selecionado');

      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('tenant_id', tenantId)
        .in('key', ['sieg_api_key', 'sieg_enabled', 'sieg_webservice_url']);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: 'Integração desativada',
        description: 'A API Key foi removida.',
      });
      refetchConfig();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível desativar a integração',
        variant: 'destructive',
      });
    },
  });

  // Save Web Service URL
  const saveWebServiceUrlMutation = useMutation({
    mutationFn: async (webServiceUrl: string) => {
      if (!tenantId) throw new Error('Tenant não selecionado');

      const trimmed = webServiceUrl.trim();
      if (!trimmed) throw new Error('URL do Web Service obrigatória');

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          tenant_id: tenantId,
          key: 'sieg_webservice_url',
          value: trimmed,
          description: 'URL do Web Service do SIEG (ex: https://api.sieg.com/BaixarXmlsV2)',
        }, { onConflict: 'tenant_id,key' });

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: 'URL salva',
        description: 'A URL do Web Service do SIEG foi atualizada.',
      });
      refetchConfig();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar URL',
        description: error.message || 'Não foi possível salvar a URL',
        variant: 'destructive',
      });
    },
  });

  // Sync XMLs from SIEG
  const syncMutation = useMutation({
    mutationFn: async (params: SyncParams): Promise<SyncResult> => {
      if (!tenantId) throw new Error('Tenant não selecionado');

      setIsSyncing(true);
      setSyncProgress('Conectando ao SIEG...');

      const { data, error } = await supabase.functions.invoke('sieg-sync', {
        body: {
          tenantId,
          cnpjEmit: params.cnpjEmit,
          dataEmissaoInicio: params.dataEmissaoInicio,
          dataEmissaoFim: params.dataEmissaoFim,
          updateMode: params.updateMode || false,
        },
      });

      if (error) throw error;
      if (!data.success && data.error) throw new Error(data.error);

      return data as SyncResult;
    },
    onSuccess: (result) => {
      setIsSyncing(false);
      setSyncProgress(null);

      if (result.imported > 0 || result.skipped > 0) {
        toast({
          title: 'Sincronização concluída',
          description: `${result.imported} notas importadas, ${result.skipped} duplicadas ignoradas${result.failed > 0 ? `, ${result.failed} com erro` : ''}`,
        });
      } else {
        toast({
          title: 'Nenhuma nota encontrada',
          description: 'Não foram encontradas notas novas no período selecionado.',
        });
      }

      refetchHistory();
      refetchConfig();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      setIsSyncing(false);
      setSyncProgress(null);
      toast({
        title: 'Erro na sincronização',
        description: error.message || 'Não foi possível sincronizar com o SIEG',
        variant: 'destructive',
      });
      refetchHistory();
    },
  });

  const startSync = useCallback((params: SyncParams) => {
    syncMutation.mutate(params);
  }, [syncMutation]);

  const saveApiKey = useCallback((apiKey: string) => {
    saveApiKeyMutation.mutate(apiKey);
  }, [saveApiKeyMutation]);

  const saveWebServiceUrl = useCallback((webServiceUrl: string) => {
    saveWebServiceUrlMutation.mutate(webServiceUrl);
  }, [saveWebServiceUrlMutation]);

  const removeApiKey = useCallback(() => {
    removeApiKeyMutation.mutate();
  }, [removeApiKeyMutation]);

  return {
    // Config
    siegConfig,
    isLoadingConfig,
    
    // Sync history
    syncHistory,
    isLoadingHistory,
    
    // Sync state
    isSyncing,
    syncProgress,
    
    // Actions
    startSync,
    saveApiKey,
    saveWebServiceUrl,
    removeApiKey,
    
    // Mutation states
    isSavingApiKey: saveApiKeyMutation.isPending,
    isSavingWebServiceUrl: saveWebServiceUrlMutation.isPending,
    isRemovingApiKey: removeApiKeyMutation.isPending,
  };
}
