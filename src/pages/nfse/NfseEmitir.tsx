import { useState, useEffect, useCallback } from 'react';
import { Loader2, FilePlus, Send, Save, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { z } from 'zod';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Issuer {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  state: string;
}

interface Tomador {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
}

const nfseSchema = z.object({
  issuer_id: z.string().min(1, 'Empresa emissora é obrigatória'),
  tomador_id: z.string().min(1, 'Tomador é obrigatório'),
  municipio_codigo: z.string().trim().min(1, 'Município é obrigatório').max(20),
  municipio_nome: z.string().trim().max(100).optional(),
  descricao_servico: z.string().trim().min(1, 'Descrição do serviço é obrigatória').max(2000),
  codigo_servico: z.string().trim().min(1, 'Código do serviço é obrigatório').max(20),
  codigo_cnae: z.string().trim().max(20).optional().or(z.literal('')),
  valor_servico: z.number().positive('Valor deve ser maior que zero'),
  data_emissao: z.string().min(1, 'Data de prestação é obrigatória'),
  // Opcionais
  valor_deducoes: z.number().min(0).default(0),
  aliquota_iss: z.number().min(0).max(100).default(0),
  valor_pis: z.number().min(0).default(0),
  valor_cofins: z.number().min(0).default(0),
  valor_inss: z.number().min(0).default(0),
  valor_ir: z.number().min(0).default(0),
  valor_csll: z.number().min(0).default(0),
  iss_retido: z.boolean().default(false),
  observacoes: z.string().trim().max(2000).optional().or(z.literal('')),
});

type NfseForm = {
  issuer_id: string;
  tomador_id: string;
  municipio_codigo: string;
  municipio_nome: string;
  descricao_servico: string;
  codigo_servico: string;
  codigo_cnae: string;
  valor_servico: string;
  data_emissao: string;
  valor_deducoes: string;
  aliquota_iss: string;
  valor_pis: string;
  valor_cofins: string;
  valor_inss: string;
  valor_ir: string;
  valor_csll: string;
  iss_retido: boolean;
  observacoes: string;
};

const emptyForm: NfseForm = {
  issuer_id: '',
  tomador_id: '',
  municipio_codigo: '',
  municipio_nome: '',
  descricao_servico: '',
  codigo_servico: '',
  codigo_cnae: '',
  valor_servico: '',
  data_emissao: new Date().toISOString().split('T')[0],
  valor_deducoes: '0',
  aliquota_iss: '0',
  valor_pis: '0',
  valor_cofins: '0',
  valor_inss: '0',
  valor_ir: '0',
  valor_csll: '0',
  iss_retido: false,
  observacoes: '',
};

export default function NfseEmitir() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { logEvent } = useAuditLog();
  const navigate = useNavigate();
  const { canCreate } = usePermissions();

  const [form, setForm] = useState<NfseForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [tomadores, setTomadores] = useState<Tomador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmEmitOpen, setConfirmEmitOpen] = useState(false);
  const [tomadorOpen, setTomadorOpen] = useState(false);
  const [issuerOpen, setIssuerOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [issuersRes, tomadoresRes] = await Promise.all([
      supabase.from('issuers').select('id, name, cnpj, city, state').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('tomadores_nfse').select('id, nome, cpf_cnpj, email, cidade, uf').eq('tenant_id', tenant.id).eq('ativo', true).order('nome'),
    ]);
    setIssuers(issuersRes.data || []);
    setTomadores(tomadoresRes.data || []);
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedTomador = tomadores.find(t => t.id === form.tomador_id);
  const selectedIssuer = issuers.find(i => i.id === form.issuer_id);

  const parseNum = (val: string) => {
    const n = parseFloat(val.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const valorServico = parseNum(form.valor_servico);
  const valorDeducoes = parseNum(form.valor_deducoes);
  const aliquotaIss = parseNum(form.aliquota_iss);
  const valorIss = ((valorServico - valorDeducoes) * aliquotaIss) / 100;
  const totalRetencoes = parseNum(form.valor_pis) + parseNum(form.valor_cofins) + parseNum(form.valor_inss) + parseNum(form.valor_ir) + parseNum(form.valor_csll);
  const valorLiquido = valorServico - valorDeducoes - (form.iss_retido ? valorIss : 0) - totalRetencoes;

  const validate = () => {
    const parsed = nfseSchema.safeParse({
      ...form,
      valor_servico: parseNum(form.valor_servico),
      valor_deducoes: parseNum(form.valor_deducoes),
      aliquota_iss: parseNum(form.aliquota_iss),
      valor_pis: parseNum(form.valor_pis),
      valor_cofins: parseNum(form.valor_cofins),
      valor_inss: parseNum(form.valor_inss),
      valor_ir: parseNum(form.valor_ir),
      valor_csll: parseNum(form.valor_csll),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const handleSaveDraft = async () => {
    const data = validate();
    if (!data) return;

    setSaving(true);
    const payload = {
      tenant_id: tenant!.id,
      status: 'rascunho' as const,
      valor_servico: data.valor_servico,
      valor_deducoes: data.valor_deducoes,
      valor_iss: valorIss,
      aliquota_iss: data.aliquota_iss,
      valor_liquido: valorLiquido,
      valor_pis: data.valor_pis,
      valor_cofins: data.valor_cofins,
      valor_inss: data.valor_inss,
      valor_ir: data.valor_ir,
      valor_csll: data.valor_csll,
      iss_retido: data.iss_retido,
      data_emissao: data.data_emissao,
      municipio_codigo: data.municipio_codigo,
      municipio_nome: data.municipio_nome || null,
      tomador_id: data.tomador_id,
      tomador_nome: selectedTomador?.nome || null,
      tomador_documento: selectedTomador?.cpf_cnpj || null,
      descricao_servico: data.descricao_servico,
      codigo_servico: data.codigo_servico,
      codigo_cnae: data.codigo_cnae || null,
      created_by: user?.id,
    };

    let error;
    if (savedId) {
      ({ error } = await supabase.from('notas_fiscais').update(payload).eq('id', savedId));
    } else {
      const res = await supabase.from('notas_fiscais').insert(payload).select('id').single();
      error = res.error;
      if (res.data) setSavedId(res.data.id);
    }

    if (error) {
      toast({ title: 'Erro ao salvar rascunho', description: error.message, variant: 'destructive' });
    } else {
      const noteId = savedId || '';
      logEvent({
        action: 'NFSE_CRIACAO',
        tableName: 'notas_fiscais',
        recordId: noteId,
        recordLabel: `DPS ${form.descricao_servico?.substring(0, 50) || ''}`,
        newData: payload,
      });
      toast({ title: 'Rascunho salvo com sucesso' });
    }
    setSaving(false);
  };

  const handleEmit = async () => {
    if (!savedId) {
      // Save first
      const data = validate();
      if (!data) return;
      await handleSaveDraft();
    }
    setConfirmEmitOpen(true);
  };

  const handleConfirmEmit = async () => {
    if (!savedId) return;
    setEmitting(true);
    setConfirmEmitOpen(false);

    try {
      // Atualizar status para fila_emissao antes de chamar o backend
      await supabase
        .from('notas_fiscais')
        .update({ status: 'fila_emissao' })
        .eq('id', savedId);

      // Chamar edge function de emissão
      const { data: result, error: fnError } = await supabase.functions.invoke('nfse-emission', {
        body: { nota_fiscal_id: savedId },
      });

      if (fnError) {
        toast({ title: 'Erro ao emitir nota', description: fnError.message, variant: 'destructive' });
        setEmitting(false);
        return;
      }

      if (result?.success) {
        logEvent({
          action: 'NFSE_EMISSAO',
          tableName: 'notas_fiscais',
          recordId: savedId,
          recordLabel: `Protocolo: ${result.protocolo}`,
          newData: { protocolo: result.protocolo, status: 'enviado' },
        });
        toast({
          title: 'NFS-e emitida com sucesso',
          description: `Protocolo: ${result.protocolo}`,
        });
      } else {
        logEvent({
          action: 'NFSE_REJEICAO',
          tableName: 'notas_fiscais',
          recordId: savedId,
          recordLabel: result?.motivo || 'Rejeitada',
          newData: { motivo: result?.motivo, status: 'rejeitado' },
        });
        toast({
          title: 'Nota rejeitada',
          description: result?.motivo || 'Erro na emissão da nota',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({ title: 'Erro ao emitir nota', description: 'Erro inesperado ao processar emissão', variant: 'destructive' });
    }

    setEmitting(false);
    navigate(ROUTES.nfse.notasEmitidas);
  };

  const setField = (name: keyof NfseForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const InputField = ({ label, name, placeholder, required, type = 'text', maxLength }: {
    label: string; name: keyof NfseForm; placeholder?: string; required?: boolean; type?: string; maxLength?: number;
  }) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}{required && ' *'}</Label>
      <Input
        id={name}
        type={type}
        value={form[name] as string}
        onChange={e => setField(name, e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={errors[name] ? 'border-destructive' : ''}
      />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
    </div>
  );

  if (!canCreate('nfse.emitir')) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para emitir notas.</p>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Emitir NFSE</h1>
          <p className="page-description">Preencha os dados para emissão da Nota Fiscal de Serviço Eletrônica</p>
        </div>
        <div className="flex gap-2">
          {savedId && (
            <Badge variant="secondary" className="h-8 px-3 flex items-center">
              Rascunho salvo
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Empresa Emissora */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresa Emissora</CardTitle>
            <CardDescription>Selecione a empresa que está emitindo a nota</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Empresa Emissora *</Label>
              <Popover open={issuerOpen} onOpenChange={setIssuerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={`w-full justify-between ${errors.issuer_id ? 'border-destructive' : ''}`}
                  >
                    {selectedIssuer ? `${selectedIssuer.name} - ${selectedIssuer.cnpj}` : 'Selecione a empresa emissora...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {issuers.map(i => (
                          <CommandItem
                            key={i.id}
                            value={`${i.name} ${i.cnpj}`}
                            onSelect={() => {
                              setField('issuer_id', i.id);
                              setField('municipio_nome', i.city);
                              setIssuerOpen(false);
                            }}
                          >
                            <div>
                              <p className="font-medium">{i.name}</p>
                              <p className="text-xs text-muted-foreground">{i.cnpj} — {i.city}/{i.state}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.issuer_id && <p className="text-xs text-destructive">{errors.issuer_id}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Tomador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tomador do Serviço</CardTitle>
            <CardDescription>Selecione o tomador (cliente) do serviço</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tomador *</Label>
                <Popover open={tomadorOpen} onOpenChange={setTomadorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`w-full justify-between ${errors.tomador_id ? 'border-destructive' : ''}`}
                    >
                      {selectedTomador ? selectedTomador.nome : 'Selecione o tomador...'}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar tomador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum tomador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {tomadores.map(t => (
                            <CommandItem
                              key={t.id}
                              value={`${t.nome} ${t.cpf_cnpj}`}
                              onSelect={() => {
                                setField('tomador_id', t.id);
                                setTomadorOpen(false);
                              }}
                            >
                              <div>
                                <p className="font-medium">{t.nome}</p>
                                <p className="text-xs text-muted-foreground">{t.cpf_cnpj}{t.cidade ? ` — ${t.cidade}/${t.uf}` : ''}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.tomador_id && <p className="text-xs text-destructive">{errors.tomador_id}</p>}
              </div>
              {selectedTomador && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                  <p className="text-sm font-medium">{selectedTomador.nome}</p>
                  <p className="text-xs text-muted-foreground">CPF/CNPJ: {selectedTomador.cpf_cnpj}</p>
                  {selectedTomador.email && <p className="text-xs text-muted-foreground">Email: {selectedTomador.email}</p>}
                  {selectedTomador.cidade && <p className="text-xs text-muted-foreground">Local: {selectedTomador.cidade}/{selectedTomador.uf}</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <div className="space-y-1.5">
                  <Label htmlFor="descricao_servico">Descrição do Serviço *</Label>
                  <Textarea
                    id="descricao_servico"
                    value={form.descricao_servico}
                    onChange={e => setField('descricao_servico', e.target.value)}
                    placeholder="Descreva o serviço prestado..."
                    maxLength={2000}
                    rows={3}
                    className={errors.descricao_servico ? 'border-destructive' : ''}
                  />
                  {errors.descricao_servico && <p className="text-xs text-destructive">{errors.descricao_servico}</p>}
                </div>
              </div>
              <InputField label="Código do Serviço" name="codigo_servico" required placeholder="Ex: 06.01" maxLength={20} />
              <InputField label="Código CNAE" name="codigo_cnae" placeholder="Ex: 8630503" maxLength={20} />
              <InputField label="Código do Município" name="municipio_codigo" required placeholder="Ex: 3550308" maxLength={20} />
              <InputField label="Valor do Serviço" name="valor_servico" required placeholder="0,00" />
              <InputField label="Data de Prestação" name="data_emissao" required type="date" />
            </div>
          </CardContent>
        </Card>

        {/* Retenções e ISS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retenções e Impostos</CardTitle>
            <CardDescription>Campos opcionais — preencha conforme aplicável</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <InputField label="Alíquota ISS (%)" name="aliquota_iss" placeholder="0" />
              <InputField label="Deduções (R$)" name="valor_deducoes" placeholder="0,00" />
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="iss_retido"
                  checked={form.iss_retido}
                  onCheckedChange={checked => setField('iss_retido', !!checked)}
                />
                <Label htmlFor="iss_retido" className="cursor-pointer">ISS Retido</Label>
              </div>
              <div />
              <InputField label="PIS (R$)" name="valor_pis" placeholder="0,00" />
              <InputField label="COFINS (R$)" name="valor_cofins" placeholder="0,00" />
              <InputField label="INSS (R$)" name="valor_inss" placeholder="0,00" />
              <InputField label="IR (R$)" name="valor_ir" placeholder="0,00" />
              <InputField label="CSLL (R$)" name="valor_csll" placeholder="0,00" />
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.observacoes}
              onChange={e => setField('observacoes', e.target.value)}
              placeholder="Observações adicionais (opcional)..."
              maxLength={2000}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Valor do Serviço</p>
                <p className="text-lg font-bold">R$ {valorServico.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">ISS ({aliquotaIss}%)</p>
                <p className="text-lg font-bold">R$ {valorIss.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Retenções</p>
                <p className="text-lg font-bold">R$ {totalRetencoes.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Valor Líquido</p>
                <p className="text-xl font-bold text-primary">R$ {valorLiquido.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Rascunho
          </Button>
          <Button onClick={handleEmit} disabled={emitting || saving} className="gap-2">
            {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Emitir Nota
          </Button>
        </div>
      </div>

      {/* Confirm Emit Dialog */}
      <Dialog open={confirmEmitOpen} onOpenChange={setConfirmEmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Emissão</DialogTitle>
            <DialogDescription>
              Deseja realmente enviar esta nota para emissão? Após o envio, a nota será colocada na fila de processamento.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Emissora:</span>
              <span className="font-medium">{selectedIssuer?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tomador:</span>
              <span className="font-medium">{selectedTomador?.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">R$ {valorServico.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Líquido:</span>
              <span className="font-bold text-primary">R$ {valorLiquido.toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmitOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmEmit} disabled={emitting} className="gap-2">
              {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Confirmar Emissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
