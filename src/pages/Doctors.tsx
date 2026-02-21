import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useTableSort } from '@/hooks/useTableSort';
import { useTablePagination } from '@/hooks/useTablePagination';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Plus, Pencil, Trash2, Loader2, Users, KeyRound, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DoctorImportExport } from '@/components/doctors/DoctorImportExport';
import { ExportDoctor } from '@/utils/doctorsExcel';

interface Doctor {
  id: string;
  name: string;
  cpf: string;
  crm: string;
  aliquota: number;
  portal_password_hash: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  phone: string | null;
  bank_name: string | null;
  pix_key: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  is_freelancer: boolean;
  birth_date: string | null;
  address: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  certificate_expires_at: string | null;
  linked_company: string | null;
  linked_company_2: string | null;
  licensee_id: string | null;
}

interface LicenseeOption {
  id: string;
  name: string;
}

export default function Doctors() {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [licensees, setLicensees] = useState<LicenseeOption[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { sortedData, requestSort, getSortDirection } = useTableSort(doctors);
  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
  } = useTablePagination(sortedData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  // Password dialog state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordDoctor, setPasswordDoctor] = useState<Doctor | null>(null);
  const [portalPassword, setPortalPassword] = useState('');
  const [resetRequired, setResetRequired] = useState(true);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    crm: '',
    aliquota: 0,
    phone: '',
    bank_name: '',
    pix_key: '',
    bank_agency: '',
    bank_account: '',
    is_freelancer: false,
    birth_date: '',
    address: '',
    neighborhood: '',
    zip_code: '',
    city: '',
    state: '',
    certificate_expires_at: '',
    linked_company: '',
    linked_company_2: '',
    licensee_id: '',
  });

  useEffect(() => {
    if (tenantId) {
      loadDoctors();
      loadLicensees();
    }
  }, [tenantId]);

  const loadLicensees = async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase
        .from('licensees')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name');
      setLicensees(data || []);
    } catch (e) {
      console.error('Error loading licensees:', e);
    }
  };

  const loadDoctors = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error: any) {
      console.error('Error loading doctors:', error);
      toast({
        title: 'Erro ao carregar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }));
  };

  const formatCEP = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.replace(/(\d{5})(\d)/, '$1-$2');
  };

  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, zip_code: formatCEP(e.target.value) }));
  };

  const openDialog = (doctor?: Doctor) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        name: doctor.name,
        cpf: doctor.cpf,
        crm: doctor.crm,
        aliquota: doctor.aliquota || 0,
        phone: doctor.phone || '',
        bank_name: doctor.bank_name || '',
        pix_key: doctor.pix_key || '',
        bank_agency: doctor.bank_agency || '',
        bank_account: doctor.bank_account || '',
        is_freelancer: doctor.is_freelancer || false,
        birth_date: doctor.birth_date || '',
        address: doctor.address || '',
        neighborhood: doctor.neighborhood || '',
        zip_code: doctor.zip_code || '',
        city: doctor.city || '',
        state: doctor.state || '',
        certificate_expires_at: doctor.certificate_expires_at || '',
        linked_company: doctor.linked_company || '',
        linked_company_2: doctor.linked_company_2 || '',
        licensee_id: doctor.licensee_id || '',
      });
    } else {
      setEditingDoctor(null);
      setFormData({
        name: '',
        cpf: '',
        crm: '',
        aliquota: 0,
        phone: '',
        bank_name: '',
        pix_key: '',
        bank_agency: '',
        bank_account: '',
        is_freelancer: false,
        birth_date: '',
        address: '',
        neighborhood: '',
        zip_code: '',
        city: '',
        state: '',
        certificate_expires_at: '',
        linked_company: '',
        linked_company_2: '',
        licensee_id: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cpf || !formData.crm) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha Nome, CPF e CRM',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const saveData = {
        name: formData.name,
        cpf: formData.cpf,
        crm: formData.crm,
        aliquota: formData.aliquota,
        phone: formData.phone || null,
        bank_name: formData.bank_name || null,
        pix_key: formData.pix_key || null,
        bank_agency: formData.bank_agency || null,
        bank_account: formData.bank_account || null,
        is_freelancer: formData.is_freelancer,
        birth_date: formData.birth_date || null,
        address: formData.address || null,
        neighborhood: formData.neighborhood || null,
        zip_code: formData.zip_code || null,
        city: formData.city || null,
        state: formData.state || null,
        certificate_expires_at: formData.certificate_expires_at || null,
        linked_company: formData.linked_company || null,
        linked_company_2: formData.linked_company_2 || null,
        licensee_id: formData.licensee_id || null,
      };

      if (editingDoctor) {
        const { error } = await supabase
          .from('doctors')
          .update(saveData)
          .eq('id', editingDoctor.id);

        if (error) throw error;

        await logEvent({
          action: 'UPDATE',
          tableName: 'doctors',
          recordId: editingDoctor.id,
          recordLabel: formData.name,
          oldData: editingDoctor,
          newData: { ...editingDoctor, ...saveData },
        });

        toast({ title: 'Médico atualizado!' });
      } else {
        // Criar médico
        const { data: newDoctor, error } = await supabase
          .from('doctors')
          .insert({ ...saveData, tenant_id: tenantId })
          .select('id')
          .single();

        if (error) {
          if (error.message.includes('duplicate')) {
            throw new Error('CPF já cadastrado');
          }
          throw error;
        }

        await logEvent({
          action: 'INSERT',
          tableName: 'doctors',
          recordId: newDoctor.id,
          recordLabel: formData.name,
          newData: { ...saveData, id: newDoctor.id },
        });

        // Configurar acesso ao portal automaticamente
        const defaultPassword = formData.crm.replace(/\D/g, '');
        const { error: portalError } = await supabase.functions.invoke('doctor-auth/set-password', {
          body: {
            doctorId: newDoctor.id,
            password: defaultPassword,
            resetRequired: true,
          },
        });

        if (portalError) {
          console.error('Erro ao configurar portal:', portalError);
          toast({ 
            title: 'Médico cadastrado!',
            description: 'Atenção: Configure a senha do portal manualmente',
          });
        } else {
          toast({ 
            title: 'Médico cadastrado!',
            description: `Acesso ao portal configurado. Usuário: ${formData.crm} | Senha inicial: ${defaultPassword}`,
          });
        }
      }

      setIsDialogOpen(false);
      loadDoctors();
    } catch (error: any) {
      console.error('Error saving doctor:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doctor: Doctor) => {
    if (!confirm(`Deseja excluir o médico ${doctor.name}?`)) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', doctor.id);

      if (error) throw error;

      await logEvent({
        action: 'DELETE',
        tableName: 'doctors',
        recordId: doctor.id,
        recordLabel: doctor.name,
        oldData: doctor,
      });

      toast({ title: 'Médico excluído!' });
      loadDoctors();
    } catch (error: any) {
      console.error('Error deleting doctor:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openPasswordDialog = (doctor: Doctor) => {
    setPasswordDoctor(doctor);
    setPortalPassword('');
    setResetRequired(true);
    setIsPasswordDialogOpen(true);
  };

  const handleSavePassword = async () => {
    if (!passwordDoctor || !portalPassword) {
      toast({
        title: 'Senha obrigatória',
        description: 'Digite uma senha para o portal',
        variant: 'destructive',
      });
      return;
    }

    if (portalPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('doctor-auth/set-password', {
        body: {
          doctorId: passwordDoctor.id,
          password: portalPassword,
          resetRequired,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({ title: 'Senha do portal definida!' });
      setIsPasswordDialogOpen(false);
      loadDoctors();
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast({
        title: 'Erro ao definir senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Map doctors for export
  const exportDoctors: ExportDoctor[] = doctors.map(d => ({
    id: d.id,
    name: d.name,
    cpf: d.cpf,
    crm: d.crm,
    aliquota: d.aliquota,
    phone: d.phone,
    bank_name: d.bank_name,
    pix_key: d.pix_key,
    bank_agency: d.bank_agency,
    bank_account: d.bank_account,
    is_freelancer: d.is_freelancer,
    birth_date: d.birth_date,
    address: d.address,
    neighborhood: d.neighborhood,
    zip_code: d.zip_code,
    city: d.city,
    state: d.state,
    certificate_expires_at: d.certificate_expires_at,
    linked_company: d.linked_company,
    linked_company_2: d.linked_company_2,
  }));

  return (
    <AppLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Médicos</h1>
          <p className="page-description">Cadastro de médicos para rateio</p>
        </div>
        <div className="flex gap-2">
          <DoctorImportExport doctors={exportDoctors} onRefresh={loadDoctors} />
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Médico
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Nenhum médico cadastrado</p>
              <Button className="mt-4" onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeiro Médico
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      sortDirection={getSortDirection('name')}
                      onSort={() => requestSort('name')}
                    >
                      Nome
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('cpf')}
                      onSort={() => requestSort('cpf')}
                    >
                      CPF
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('crm')}
                      onSort={() => requestSort('crm')}
                    >
                      CRM
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('linked_company')}
                      onSort={() => requestSort('linked_company')}
                    >
                      Empresa
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('phone')}
                      onSort={() => requestSort('phone')}
                    >
                      Telefone
                    </SortableTableHead>
                    <SortableTableHead
                      sortDirection={getSortDirection('aliquota')}
                      onSort={() => requestSort('aliquota')}
                    >
                      Alíquota
                    </SortableTableHead>
                    <SortableTableHead sortable={false}>Portal</SortableTableHead>
                    <SortableTableHead sortable={false} className="w-[140px]"></SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((doctor) => (
                    <TableRow key={doctor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {doctor.name}
                          {doctor.is_freelancer && (
                            <Badge variant="outline" className="text-xs">Avulso</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{doctor.cpf}</TableCell>
                      <TableCell>{doctor.crm}</TableCell>
                      <TableCell>{doctor.linked_company || '-'}</TableCell>
                      <TableCell>{doctor.phone || '-'}</TableCell>
                      <TableCell>{doctor.aliquota}%</TableCell>
                      <TableCell>
                        {doctor.portal_password_hash ? (
                          <Badge variant="outline" className="text-success border-success/30">
                            <Check className="mr-1 h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Não configurado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openPasswordDialog(doctor)}
                            title="Configurar senha do portal"
                          >
                            <KeyRound className="h-4 w-4 text-warning" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDialog(doctor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(doctor)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalItems > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  onPageChange={goToPage}
                  onNextPage={nextPage}
                  onPrevPage={prevPage}
                  onFirstPage={firstPage}
                  onLastPage={lastPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoctor ? 'Editar Médico' : 'Novo Médico'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do médico
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
              <TabsTrigger value="bank">Dados Bancários</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Dr. João Silva"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={handleCPFChange}
                      placeholder="000.000.000-00"
                      className="font-mono"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="crm">CRM *</Label>
                    <Input
                      id="crm"
                      value={formData.crm}
                      onChange={(e) => setFormData(prev => ({ ...prev, crm: e.target.value }))}
                      placeholder="12345/PE"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(81) 99999-9999"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="birth_date">Data de Nascimento</Label>
                    <Input
                      id="birth_date"
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="aliquota">Alíquota (%)</Label>
                    <Input
                      id="aliquota"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.aliquota}
                      onChange={(e) => setFormData(prev => ({ ...prev, aliquota: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="certificate_expires_at">Validade Certificado</Label>
                    <Input
                      id="certificate_expires_at"
                      type="date"
                      value={formData.certificate_expires_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, certificate_expires_at: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="linked_company">Empresa Vinculada</Label>
                    <Input
                      id="linked_company"
                      value={formData.linked_company}
                      onChange={(e) => setFormData(prev => ({ ...prev, linked_company: e.target.value }))}
                      placeholder="MaisMed Gestão"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="linked_company_2">Empresa 2 (opcional)</Label>
                    <Input
                      id="linked_company_2"
                      value={formData.linked_company_2}
                      onChange={(e) => setFormData(prev => ({ ...prev, linked_company_2: e.target.value }))}
                      placeholder=""
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="licensee_id">Licenciado (Parceiro)</Label>
                  <Select
                    value={formData.licensee_id || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, licensee_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um licenciado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {licensees.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_freelancer"
                    checked={formData.is_freelancer}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_freelancer: checked }))}
                  />
                  <Label htmlFor="is_freelancer">Médico Avulso</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Banco do Brasil"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bank_agency">Agência</Label>
                    <Input
                      id="bank_agency"
                      value={formData.bank_agency}
                      onChange={(e) => setFormData(prev => ({ ...prev, bank_agency: e.target.value }))}
                      placeholder="1234-5"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bank_account">Conta</Label>
                    <Input
                      id="bank_account"
                      value={formData.bank_account}
                      onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                      placeholder="12345-6"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pix_key">Chave PIX</Label>
                  <Input
                    id="pix_key"
                    value={formData.pix_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, pix_key: e.target.value }))}
                    placeholder="CPF, email, telefone ou chave aleatória"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Rua Exemplo, 123"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                      placeholder="Centro"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="zip_code">CEP</Label>
                    <Input
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => handleCEPChange(e)}
                      placeholder="00000-000"
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Recife"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="state">Estado (UF)</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                      placeholder="PE"
                      maxLength={2}
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha do Portal</DialogTitle>
            <DialogDescription>
              Defina a senha de acesso ao portal para {passwordDoctor?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="portalPassword">Senha</Label>
              <Input
                id="portalPassword"
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="resetRequired">Solicitar alteração no primeiro login</Label>
                <p className="text-sm text-muted-foreground">
                  O médico precisará definir uma nova senha ao acessar
                </p>
              </div>
              <Switch
                id="resetRequired"
                checked={resetRequired}
                onCheckedChange={setResetRequired}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePassword} disabled={isSavingPassword}>
              {isSavingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Senha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
