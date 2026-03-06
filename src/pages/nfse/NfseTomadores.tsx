import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Search, Contact } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Tomador {
  id: string;
  nome: string;
  cpf_cnpj: string;
  inscricao_municipal: string | null;
  email: string | null;
  telefone: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  ativo: boolean;
}

const tomadorSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  cpf_cnpj: z.string().trim().min(11, 'CPF/CNPJ inválido').max(18),
  inscricao_municipal: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  telefone: z.string().trim().max(20).optional().or(z.literal('')),
  logradouro: z.string().trim().max(200).optional().or(z.literal('')),
  numero: z.string().trim().max(20).optional().or(z.literal('')),
  bairro: z.string().trim().max(100).optional().or(z.literal('')),
  cidade: z.string().trim().max(100).optional().or(z.literal('')),
  uf: z.string().trim().max(2).optional().or(z.literal('')),
  cep: z.string().trim().max(10).optional().or(z.literal('')),
});

type TomadorForm = z.infer<typeof tomadorSchema>;

const emptyForm: TomadorForm = {
  nome: '', cpf_cnpj: '', inscricao_municipal: '', email: '', telefone: '',
  logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '',
};

export default function NfseTomadores() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { canCreate, canUpdate } = usePermissions();
  const canManage = canCreate('nfse.emitir');
  const canEdit = canUpdate('nfse.emitir');

  const [tomadores, setTomadores] = useState<Tomador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TomadorForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTomadores = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tomadores_nfse')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('nome');

    if (error) {
      toast({ title: 'Erro ao carregar tomadores', description: error.message, variant: 'destructive' });
    } else {
      setTomadores(data || []);
    }
    setLoading(false);
  }, [tenant?.id, toast]);

  useEffect(() => { loadTomadores(); }, [loadTomadores]);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  };

  const handleOpenEdit = (t: Tomador) => {
    setEditingId(t.id);
    setForm({
      nome: t.nome,
      cpf_cnpj: t.cpf_cnpj,
      inscricao_municipal: t.inscricao_municipal || '',
      email: t.email || '',
      telefone: t.telefone || '',
      logradouro: t.logradouro || '',
      numero: t.numero || '',
      bairro: t.bairro || '',
      cidade: t.cidade || '',
      uf: t.uf || '',
      cep: t.cep || '',
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const result = tomadorSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const payload = {
      nome: result.data.nome,
      cpf_cnpj: result.data.cpf_cnpj,
      inscricao_municipal: result.data.inscricao_municipal || null,
      email: result.data.email || null,
      telefone: result.data.telefone || null,
      logradouro: result.data.logradouro || null,
      numero: result.data.numero || null,
      bairro: result.data.bairro || null,
      cidade: result.data.cidade || null,
      uf: result.data.uf || null,
      cep: result.data.cep || null,
      tenant_id: tenant!.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('tomadores_nfse').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('tomadores_nfse').insert(payload));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingId ? 'Tomador atualizado' : 'Tomador criado' });
      setDialogOpen(false);
      loadTomadores();
    }
    setSaving(false);
  };

  const filtered = tomadores.filter(t => {
    const q = search.toLowerCase();
    return t.nome.toLowerCase().includes(q) || t.cpf_cnpj.includes(q) || (t.email?.toLowerCase().includes(q));
  });

  const Field = ({ label, name, placeholder, maxLength }: { label: string; name: keyof TomadorForm; placeholder?: string; maxLength?: number }) => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        value={form[name] || ''}
        onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
        placeholder={placeholder}
        maxLength={maxLength}
        className={errors[name] ? 'border-destructive' : ''}
      />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Tomadores de Serviço</h1>
          <p className="page-description">Cadastro de tomadores para emissão de NFSE</p>
        </div>
        {canManage && (
          <Button onClick={handleOpenNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Tomador
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ ou email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filtered.length} tomador(es)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <Contact className="h-8 w-8" />
              <p>Nenhum tomador encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell>{t.cpf_cnpj}</TableCell>
                      <TableCell>{t.email || '—'}</TableCell>
                      <TableCell>{t.telefone || '—'}</TableCell>
                      <TableCell>{t.cidade && t.uf ? `${t.cidade}/${t.uf}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={t.ativo ? 'default' : 'secondary'}>
                          {t.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Tomador' : 'Novo Tomador'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome *" name="nome" placeholder="Razão social ou nome" maxLength={200} />
            <Field label="CPF/CNPJ *" name="cpf_cnpj" placeholder="000.000.000-00" maxLength={18} />
            <Field label="Inscrição Municipal" name="inscricao_municipal" maxLength={30} />
            <Field label="Email" name="email" placeholder="email@exemplo.com" maxLength={255} />
            <Field label="Telefone" name="telefone" placeholder="(00) 00000-0000" maxLength={20} />
            <Field label="CEP" name="cep" placeholder="00000-000" maxLength={10} />
            <Field label="Logradouro" name="logradouro" maxLength={200} />
            <Field label="Número" name="numero" maxLength={20} />
            <Field label="Bairro" name="bairro" maxLength={100} />
            <Field label="Cidade" name="cidade" maxLength={100} />
            <Field label="UF" name="uf" placeholder="SP" maxLength={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
