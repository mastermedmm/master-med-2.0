import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, Globe, MapPin, Building2, Save, Loader2, ShieldCheck, ShieldAlert, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { format, isPast, differenceInDays } from 'date-fns';

interface NfseConfig {
  id?: string;
  tenant_id: string;
  issuer_id: string | null;
  certificado_base64: string | null;
  certificado_senha: string | null;
  certificado_validade: string | null;
  certificado_nome: string | null;
  ambiente: 'homologacao' | 'producao';
  endpoint_api: string | null;
  municipio_codigo: string | null;
  municipio_nome: string | null;
  municipio_uf: string | null;
  inscricao_municipal: string | null;
  prestador_cnpj: string | null;
  prestador_razao_social: string | null;
}

interface Issuer {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  state: string;
  active: boolean;
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const emptyForm: Partial<NfseConfig> = {
  ambiente: 'homologacao',
  certificado_base64: null,
  certificado_senha: null,
  certificado_validade: null,
  certificado_nome: null,
  endpoint_api: null,
  municipio_codigo: null,
  municipio_nome: null,
  municipio_uf: null,
  inscricao_municipal: null,
  prestador_cnpj: null,
  prestador_razao_social: null,
};

export default function NfseConfiguracoes() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { canUpdate } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = canUpdate('nfse.configuracoes');

  const [selectedIssuerId, setSelectedIssuerId] = useState<string>('');
  const [form, setForm] = useState<Partial<NfseConfig>>({ ...emptyForm });

  // Fetch issuers for this tenant
  const { data: issuers, isLoading: issuersLoading } = useQuery({
    queryKey: ['issuers-for-nfse', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issuers')
        .select('id, name, cnpj, city, state, active')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as Issuer[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch config for selected issuer
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['nfse-config', tenant?.id, selectedIssuerId],
    queryFn: async () => {
      if (!tenant?.id || !selectedIssuerId) return null;
      const { data, error } = await supabase
        .from('configuracoes_nfse' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('issuer_id', selectedIssuerId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as NfseConfig | null;
    },
    enabled: !!tenant?.id && !!selectedIssuerId,
  });

  // Auto-select first issuer
  useEffect(() => {
    if (issuers?.length && !selectedIssuerId) {
      setSelectedIssuerId(issuers[0].id);
    }
  }, [issuers, selectedIssuerId]);

  // Load config into form when data arrives
  useEffect(() => {
    if (config) {
      setForm({
        ambiente: config.ambiente || 'homologacao',
        certificado_base64: config.certificado_base64,
        certificado_senha: config.certificado_senha,
        certificado_validade: config.certificado_validade,
        certificado_nome: config.certificado_nome,
        endpoint_api: config.endpoint_api,
        municipio_codigo: config.municipio_codigo,
        municipio_nome: config.municipio_nome,
        municipio_uf: config.municipio_uf,
        inscricao_municipal: config.inscricao_municipal,
        prestador_cnpj: config.prestador_cnpj,
        prestador_razao_social: config.prestador_razao_social,
      });
    } else {
      // Pre-fill from issuer data
      const issuer = issuers?.find(i => i.id === selectedIssuerId);
      setForm({
        ...emptyForm,
        municipio_nome: issuer?.city || null,
        municipio_uf: issuer?.state || null,
        prestador_cnpj: issuer?.cnpj || null,
        prestador_razao_social: issuer?.name || null,
      });
    }
  }, [config, selectedIssuerId, issuers]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !selectedIssuerId) throw new Error('Selecione um emitente');

      const payload = {
        tenant_id: tenant.id,
        issuer_id: selectedIssuerId,
        ...form,
        updated_by: user?.id,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('configuracoes_nfse' as any)
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes_nfse' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configurações salvas com sucesso');
      queryClient.invalidateQueries({ queryKey: ['nfse-config'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar: ' + err.message);
    },
  });

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error('O certificado deve ser um arquivo .pfx ou .p12');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setForm(prev => ({ ...prev, certificado_base64: base64, certificado_nome: file.name }));
      toast.success(`Certificado "${file.name}" carregado`);
    };
    reader.readAsDataURL(file);
  };

  const certValidade = form.certificado_validade ? new Date(form.certificado_validade) : null;
  const certExpirado = certValidade ? isPast(certValidade) : false;
  const certDiasRestantes = certValidade ? differenceInDays(certValidade, new Date()) : null;

  const selectedIssuer = issuers?.find(i => i.id === selectedIssuerId);
  const isLoading = issuersLoading || configLoading;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Configurações NFSE</h1>
          <p className="page-description">Configurações da integração por emitente</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !canEdit || !selectedIssuerId}
        >
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>

      {/* Issuer Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Emitente
          </CardTitle>
          <CardDescription>Selecione o emitente para configurar a integração NFSE</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedIssuerId} onValueChange={setSelectedIssuerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um emitente..." />
            </SelectTrigger>
            <SelectContent>
              {issuers?.map(issuer => (
                <SelectItem key={issuer.id} value={issuer.id}>
                  {issuer.name} — {issuer.cnpj}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {issuers?.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum emitente cadastrado. Cadastre emitentes no menu Cadastro → Emitentes.
            </p>
          )}
          {selectedIssuer && config && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline">Configurado</Badge>
              <span className="text-sm text-muted-foreground">
                Ambiente: {config.ambiente === 'producao' ? '🟢 Produção' : '🟡 Homologação'}
              </span>
            </div>
          )}
          {selectedIssuer && !config && !configLoading && (
            <p className="mt-2 text-sm text-muted-foreground">
              Este emitente ainda não possui configuração NFSE. Preencha os dados abaixo.
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading && selectedIssuerId && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedIssuerId && !isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Certificado Digital */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Certificado Digital
              </CardTitle>
              <CardDescription>Certificado A1 (.pfx/.p12) para assinatura das notas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo do Certificado</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <Button variant="outline" size="sm" asChild disabled={!canEdit}>
                    <label className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Selecionar Arquivo
                      <input type="file" accept=".pfx,.p12" className="hidden" onChange={handleCertificateUpload} />
                    </label>
                  </Button>
                  {form.certificado_nome && (
                    <span className="text-sm text-muted-foreground">{form.certificado_nome}</span>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="cert-senha">Senha do Certificado</Label>
                <Input
                  id="cert-senha"
                  type="password"
                  placeholder="••••••••"
                  value={form.certificado_senha || ''}
                  onChange={e => setForm(prev => ({ ...prev, certificado_senha: e.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>

              <div>
                <Label htmlFor="cert-validade">Validade do Certificado</Label>
                <Input
                  id="cert-validade"
                  type="date"
                  value={form.certificado_validade || ''}
                  onChange={e => setForm(prev => ({ ...prev, certificado_validade: e.target.value || null }))}
                  disabled={!canEdit}
                />
                {certValidade && (
                  <div className="mt-1.5">
                    {certExpirado ? (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Certificado expirado
                      </Badge>
                    ) : certDiasRestantes !== null && certDiasRestantes <= 30 ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Expira em {certDiasRestantes} dias
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Válido até {format(certValidade, 'dd/MM/yyyy')}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ambiente e Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Ambiente da API
              </CardTitle>
              <CardDescription>Conexão com o Sistema Nacional da NFS-e</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Ambiente</Label>
                <Select
                  value={form.ambiente || 'homologacao'}
                  onValueChange={v => setForm(prev => ({ ...prev, ambiente: v as 'homologacao' | 'producao' }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">🟡 Homologação (testes)</SelectItem>
                    <SelectItem value="producao">🟢 Produção</SelectItem>
                  </SelectContent>
                </Select>
                {form.ambiente === 'producao' && (
                  <p className="mt-1.5 text-sm text-destructive font-medium">
                    ⚠️ Notas emitidas em produção têm validade fiscal
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="endpoint">Endpoint da API</Label>
                <Input
                  id="endpoint"
                  placeholder="https://sefin.nfse.gov.br/sefinnacional"
                  value={form.endpoint_api || ''}
                  onChange={e => setForm(prev => ({ ...prev, endpoint_api: e.target.value || null }))}
                  disabled={!canEdit}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Deixe em branco para usar o endpoint padrão
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Município Emissor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Município Emissor
              </CardTitle>
              <CardDescription>Município onde o prestador está estabelecido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mun-codigo">Código IBGE</Label>
                  <Input
                    id="mun-codigo"
                    placeholder="3550308"
                    value={form.municipio_codigo || ''}
                    onChange={e => setForm(prev => ({ ...prev, municipio_codigo: e.target.value || null }))}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>UF</Label>
                  <Select
                    value={form.municipio_uf || ''}
                    onValueChange={v => setForm(prev => ({ ...prev, municipio_uf: v }))}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="mt-0">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="mun-nome">Nome do Município</Label>
                <Input
                  id="mun-nome"
                  placeholder="São Paulo"
                  value={form.municipio_nome || ''}
                  onChange={e => setForm(prev => ({ ...prev, municipio_nome: e.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="inscricao-municipal">Inscrição Municipal</Label>
                <Input
                  id="inscricao-municipal"
                  placeholder="12345678"
                  value={form.inscricao_municipal || ''}
                  onChange={e => setForm(prev => ({ ...prev, inscricao_municipal: e.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dados do Prestador */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados do Prestador
              </CardTitle>
              <CardDescription>Informações da empresa emissora</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prestador-cnpj">CNPJ do Prestador</Label>
                <Input
                  id="prestador-cnpj"
                  placeholder="00.000.000/0001-00"
                  value={form.prestador_cnpj || ''}
                  onChange={e => setForm(prev => ({ ...prev, prestador_cnpj: e.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="prestador-razao">Razão Social</Label>
                <Input
                  id="prestador-razao"
                  placeholder="Empresa Ltda"
                  value={form.prestador_razao_social || ''}
                  onChange={e => setForm(prev => ({ ...prev, prestador_razao_social: e.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
