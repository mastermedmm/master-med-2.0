import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useSiegSync } from '@/hooks/useSiegSync';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Cloud,
  CloudOff,
  Key,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Download,
  History,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';

export default function SiegIntegration() {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const {
    siegConfig,
    isLoadingConfig,
    syncHistory,
    isLoadingHistory,
    isSyncing,
    startSync,
    saveApiKey,
    saveWebServiceUrl,
    removeApiKey,
    isSavingApiKey,
    isSavingWebServiceUrl,
    isRemovingApiKey,
  } = useSiegSync();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [webServiceUrl, setWebServiceUrl] = useState('https://api.sieg.com/BaixarXmls');
  const [showApiKey, setShowApiKey] = useState(false);
  const [updateMode, setUpdateMode] = useState(false);
  const [selectedCnpj, setSelectedCnpj] = useState('');
  const [dateStart, setDateStart] = useState(() =>
    format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  );
  const [dateEnd, setDateEnd] = useState(() =>
    format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  );

  useEffect(() => {
    if (siegConfig?.webServiceUrl) setWebServiceUrl(siegConfig.webServiceUrl);
  }, [siegConfig?.webServiceUrl]);

  // Fetch issuers for CNPJ filter
  const { data: issuers } = useQuery({
    queryKey: ['issuers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('issuers')
        .select('id, name, cnpj')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      toast({
        title: 'API Key obrigatória',
        description: 'Digite a API Key do SIEG',
        variant: 'destructive',
      });
      return;
    }
    saveApiKey(apiKeyInput.trim());
    setApiKeyInput('');
  };

  const handleSaveWebServiceUrl = () => {
    if (!webServiceUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Digite a URL do Web Service do SIEG',
        variant: 'destructive',
      });
      return;
    }
    saveWebServiceUrl(webServiceUrl.trim());
  };

  const handleSync = () => {
    if (!dateStart || !dateEnd) {
      toast({
        title: 'Datas obrigatórias',
        description: 'Selecione o período de emissão das notas',
        variant: 'destructive',
      });
      return;
    }

    startSync({
      cnpjEmit: selectedCnpj || undefined,
      dataEmissaoInicio: dateStart,
      dataEmissaoFim: dateEnd,
      updateMode,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-600"><CheckCircle className="mr-1 h-3 w-3" />Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Falhou</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/20 text-blue-600"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Em andamento</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="mr-1 h-3 w-3" />Pendente</Badge>;
    }
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Integração SIEG</h1>
        <p className="page-description">
          Configure a integração para download automático de XMLs de NFS-e emitidas
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* API Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configuração da API
            </CardTitle>
            <CardDescription>
              Configure sua API Key do SIEG para habilitar o download automático
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingConfig ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
              ) : siegConfig?.hasApiKey ? (
               <div className="space-y-4">
                 <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                   <div className="flex items-center gap-3">
                     <Cloud className="h-8 w-8 text-green-500" />
                     <div>
                       <p className="font-medium text-green-600">Integração Ativa</p>
                       <p className="text-sm text-muted-foreground">
                         {siegConfig.lastSync
                           ? `Última sincronização: ${format(new Date(siegConfig.lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                           : 'Nenhuma sincronização realizada'}
                       </p>
                     </div>
                   </div>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={removeApiKey}
                     disabled={isRemovingApiKey}
                   >
                     {isRemovingApiKey ? (
                       <Loader2 className="h-4 w-4 animate-spin" />
                     ) : (
                       <Trash2 className="h-4 w-4" />
                     )}
                   </Button>
                 </div>

                 <div className="space-y-2">
                   <Label htmlFor="webServiceUrl">URL do Web Service</Label>
                   <div className="flex gap-2">
                     <Input
                       id="webServiceUrl"
                        placeholder="https://api.sieg.com/BaixarXmlsV2"
                        value={webServiceUrl}
                       onChange={(e) => setWebServiceUrl(e.target.value)}
                     />
                     <Button
                       type="button"
                       variant="outline"
                       onClick={handleSaveWebServiceUrl}
                       disabled={isSavingWebServiceUrl}
                     >
                       {isSavingWebServiceUrl ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         'Salvar URL'
                       )}
                     </Button>
                   </div>
                 </div>
               </div>
            ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                    <CloudOff className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Integração Desativada</p>
                      <p className="text-sm text-muted-foreground">
                        Configure a URL e sua API Key para começar
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webServiceUrl">URL do Web Service</Label>
                    <div className="flex gap-2">
                      <Input
                        id="webServiceUrl"
                        placeholder="https://api.sieg.com/BaixarXmlsV2"
                        value={webServiceUrl}
                        onChange={(e) => setWebServiceUrl(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveWebServiceUrl}
                        disabled={isSavingWebServiceUrl}
                      >
                        {isSavingWebServiceUrl ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Salvar URL'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Conforme a documentação do SIEG. Normalmente é{' '}
                      <code>https://api.sieg.com/BaixarXmlsV2</code>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key do SIEG</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="apiKey"
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Digite sua API Key"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button onClick={handleSaveApiKey} disabled={isSavingApiKey}>
                        {isSavingApiKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Obtenha sua API Key em{' '}
                      <a
                        href="https://www.sieg.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Minha Conta no portal SIEG
                      </a>
                    </p>
                  </div>
                </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Sync Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Sincronização Manual
            </CardTitle>
            <CardDescription>
              Baixe XMLs de NFS-e emitidas em um período específico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateStart">Data Início</Label>
                <Input
                  id="dateStart"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateEnd">Data Fim</Label>
                <Input
                  id="dateEnd"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">Filtrar por Emitente (opcional)</Label>
              <select
                id="cnpj"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedCnpj}
                onChange={(e) => setSelectedCnpj(e.target.value)}
              >
                <option value="">Todos os emitentes</option>
                {issuers?.map((issuer) => (
                  <option key={issuer.id} value={issuer.cnpj}>
                    {issuer.name} ({formatCNPJ(issuer.cnpj)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="updateMode"
                checked={updateMode}
                onCheckedChange={setUpdateMode}
              />
              <Label htmlFor="updateMode" className="text-sm">
                Atualizar notas existentes
              </Label>
            </div>

            {isSyncing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleSync}
              disabled={!siegConfig?.hasApiKey || isSyncing}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Agora
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sync History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Sincronizações
          </CardTitle>
          <CardDescription>
            Últimas sincronizações realizadas com o SIEG
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !syncHistory?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma sincronização realizada ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-center">Importadas</TableHead>
                  <TableHead className="text-center">Duplicadas</TableHead>
                  <TableHead className="text-center">Erros</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map((log) => (
                  <Collapsible key={log.id} asChild>
                    <>
                      <TableRow>
                        <TableCell>
                          {format(new Date(log.sync_started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          {log.filter_date_start && log.filter_date_end
                            ? `${format(parseISO(log.filter_date_start), 'dd/MM/yyyy')} - ${format(parseISO(log.filter_date_end), 'dd/MM/yyyy')}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center font-medium text-green-600">
                          {log.xmls_imported}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {log.xmls_skipped}
                        </TableCell>
                        <TableCell className="text-center text-red-500">
                          {log.xmls_failed}
                        </TableCell>
                        <TableCell>
                          {log.error_message && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                      </TableRow>
                      {log.error_message && (
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/50">
                              <p className="text-sm text-destructive">
                                <strong>Erro:</strong> {log.error_message}
                              </p>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      )}
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
