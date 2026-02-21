import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Plus, Pencil, Trash2, Handshake, KeyRound } from 'lucide-react';

interface Licensee {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  commission: number;
  active: boolean;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function Licensees() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const { logEvent } = useAuditLog();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [licensees, setLicensees] = useState<Licensee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordLicensee, setPasswordLicensee] = useState<Licensee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [commission, setCommission] = useState('');

  useEffect(() => {
    if (tenantId) loadLicensees();
  }, [tenantId]);

  const loadLicensees = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('licensees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setLicensees((data as Licensee[]) || []);
    } catch (error) {
      console.error('Error loading licensees:', error);
      toast({ title: 'Erro ao carregar licenciados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setCpf('');
    setCommission('');
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (l: Licensee) => {
    setEditingId(l.id);
    setName(l.name);
    setEmail(l.email || '');
    setCpf(l.cpf);
    setCommission(l.commission.toString().replace('.', ','));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !cpf.trim() || !commission.trim()) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const commissionNum = parseFloat(commission.replace(',', '.'));
    if (isNaN(commissionNum)) {
      toast({ title: 'Comissão inválida', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const record = {
        name: name.trim(),
        email: email.trim() || null,
        cpf: cpf.trim(),
        commission: commissionNum,
        tenant_id: tenantId,
      };

      if (editingId) {
        const { error } = await supabase
          .from('licensees')
          .update({ ...record, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;

        await logEvent({ action: 'UPDATE', tableName: 'licensees', recordId: editingId, recordLabel: name.trim() });
        toast({ title: 'Licenciado atualizado com sucesso' });
      } else {
        const { data, error } = await supabase
          .from('licensees')
          .insert(record)
          .select('id')
          .single();
        if (error) throw error;

        await logEvent({ action: 'INSERT', tableName: 'licensees', recordId: data.id, recordLabel: name.trim() });
        toast({ title: 'Licenciado cadastrado com sucesso' });
      }

      setDialogOpen(false);
      resetForm();
      await loadLicensees();
    } catch (error) {
      console.error('Error saving licensee:', error);
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (l: Licensee) => {
    if (!confirm(`Deseja excluir o licenciado "${l.name}"?`)) return;

    try {
      const { error } = await supabase.from('licensees').delete().eq('id', l.id);
      if (error) throw error;

      await logEvent({ action: 'DELETE', tableName: 'licensees', recordId: l.id, recordLabel: l.name });
      toast({ title: 'Licenciado excluído' });
      await loadLicensees();
    } catch (error) {
      console.error('Error deleting licensee:', error);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const formatCommission = (val: number) =>
    val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const openPasswordDialog = (l: Licensee) => {
    setPasswordLicensee(l);
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const handleSetPassword = async () => {
    if (!passwordLicensee || !newPassword) return;
    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('licensee-auth/set-password', {
        body: { licenseeId: passwordLicensee.id, password: newPassword, resetRequired: true },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      toast({ title: 'Senha definida com sucesso', description: 'O licenciado deverá trocar a senha no primeiro acesso' });
      setPasswordDialogOpen(false);
    } catch (error) {
      console.error('Error setting password:', error);
      toast({ title: 'Erro ao definir senha', variant: 'destructive' });
    } finally {
      setSettingPassword(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Handshake className="h-7 w-7 text-primary" />
            Licenciados
          </h1>
          <p className="text-muted-foreground">Gerencie os licenciados (parceiros) cadastrados</p>
        </div>
        {canCreate('doctors') && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Licenciado
          </Button>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Licenciados Cadastrados</CardTitle>
          <CardDescription>{licensees.length} licenciado(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licensees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum licenciado cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                licensees.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.email || '-'}</TableCell>
                    <TableCell>{l.cpf}</TableCell>
                    <TableCell className="text-right">{formatCommission(l.commission)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canUpdate('doctors') && (
                          <Button variant="ghost" size="icon" onClick={() => openPasswordDialog(l)} title="Definir senha do portal">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        {canUpdate('doctors') && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('doctors') && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(l)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Licenciado' : 'Novo Licenciado'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados do licenciado' : 'Preencha os dados do novo licenciado'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lic-name">Nome *</Label>
              <Input id="lic-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lic-email">Email</Label>
              <Input id="lic-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Coloque aqui o email do médico" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lic-cpf">CPF *</Label>
              <Input id="lic-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lic-commission">Comissão *</Label>
              <Input id="lic-commission" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="1,00" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Senha do Portal</DialogTitle>
            <DialogDescription>
              Defina a senha de acesso ao Portal do Licenciado para <strong>{passwordLicensee?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lic-password">Nova Senha</Label>
              <Input id="lic-password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <p className="text-sm text-muted-foreground">
              O licenciado será solicitado a trocar a senha no primeiro acesso ao portal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={settingPassword}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={settingPassword || newPassword.length < 6}>
              {settingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Definir Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
