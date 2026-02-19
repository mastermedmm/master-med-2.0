import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/super-admin/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, ArrowLeft, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface TenantFormData {
  name: string;
  slug: string;
  document: string;
  email: string;
  phone: string;
  plan: string;
  status: string;
  max_users: number;
}

interface AdminFormData {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

export default function TenantForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    slug: '',
    document: '',
    email: '',
    phone: '',
    plan: 'trial',
    status: 'active',
    max_users: 5,
  });

  const [adminData, setAdminData] = useState<AdminFormData>({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // Fetch tenant for editing
  const { data: tenant, isLoading: isLoadingTenant } = useQuery({
    queryKey: ['super-admin-tenant', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name,
        slug: tenant.slug,
        document: tenant.document || '',
        email: tenant.email,
        phone: tenant.phone || '',
        plan: tenant.plan,
        status: tenant.status,
        max_users: tenant.max_users,
      });
    }
  }, [tenant]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEditing && formData.name) {
      setFormData(prev => ({ ...prev, slug: generateSlug(prev.name) }));
    }
  }, [formData.name, isEditing]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: TenantFormData) => {
      // First create the tenant
      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          document: data.document || null,
          email: data.email,
          phone: data.phone || null,
          plan: data.plan,
          status: data.status,
          max_users: data.max_users,
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTenant;
    },
    onSuccess: async (newTenant) => {
      // If admin data is provided, create the admin user
      if (adminData.email && adminData.password && adminData.full_name) {
        setIsCreatingAdmin(true);
        try {
          const { data, error } = await supabase.functions.invoke('create-tenant-admin', {
            body: {
              tenant_id: newTenant.id,
              email: adminData.email,
              password: adminData.password,
              full_name: adminData.full_name,
            },
          });

          if (error) {
            console.error('Error creating admin:', error);
            toast.error('Empresa criada, mas houve erro ao criar o administrador: ' + error.message);
          } else if (data?.error) {
            toast.error('Empresa criada, mas houve erro ao criar o administrador: ' + data.error);
          } else {
            toast.success('Empresa e administrador criados com sucesso!');
          }
        } catch (err: any) {
          console.error('Error creating admin:', err);
          toast.error('Empresa criada, mas houve erro ao criar o administrador');
        } finally {
          setIsCreatingAdmin(false);
        }
      } else {
        toast.success('Empresa criada com sucesso!');
      }
      
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      navigate('/super-admin/tenants');
    },
    onError: (error: any) => {
      console.error('Create error:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('Já existe uma empresa com este slug');
      } else {
        toast.error('Erro ao criar empresa');
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: TenantFormData) => {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: data.name,
          slug: data.slug,
          document: data.document || null,
          email: data.email,
          phone: data.phone || null,
          plan: data.plan,
          status: data.status,
          max_users: data.max_users,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      // If admin data is provided, create the admin user
      if (adminData.email && adminData.password && adminData.full_name) {
        setIsCreatingAdmin(true);
        try {
          const { data, error } = await supabase.functions.invoke('create-tenant-admin', {
            body: {
              tenant_id: id,
              email: adminData.email,
              password: adminData.password,
              full_name: adminData.full_name,
            },
          });

          if (error) {
            console.error('Error creating admin:', error);
            toast.error('Empresa atualizada, mas houve erro ao criar o administrador: ' + error.message);
          } else if (data?.error) {
            toast.error('Empresa atualizada, mas houve erro ao criar o administrador: ' + data.error);
          } else {
            toast.success('Empresa atualizada e administrador criado com sucesso!');
          }
        } catch (err: any) {
          console.error('Error creating admin:', err);
          toast.error('Empresa atualizada, mas houve erro ao criar o administrador');
        } finally {
          setIsCreatingAdmin(false);
        }
      } else {
        toast.success('Empresa atualizada com sucesso!');
      }

      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenant', id] });
      navigate('/super-admin/tenants');
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('Já existe uma empresa com este slug');
      } else {
        toast.error('Erro ao atualizar empresa');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.slug) {
      toast.error('Preencha todos os campos obrigatórios da empresa');
      return;
    }

    // Validate admin fields if any is filled
    const hasAnyAdminField = adminData.email || adminData.password || adminData.full_name;
    const hasAllAdminFields = adminData.email && adminData.password && adminData.full_name;
    
    if (hasAnyAdminField && !hasAllAdminFields) {
      toast.error('Preencha todos os campos do administrador ou deixe todos em branco');
      return;
    }

    if (adminData.password && adminData.password !== adminData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (adminData.password && adminData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || isCreatingAdmin;

  if (isEditing && isLoadingTenant) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin/tenants')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="page-header mb-0">
            <h1 className="page-title">
              {isEditing ? 'Editar Empresa' : 'Nova Empresa'}
            </h1>
            <p className="page-description">
              {isEditing 
                ? 'Atualize as informações da empresa'
                : 'Cadastre uma nova empresa na plataforma'
              }
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>
              Campos marcados com * são obrigatórios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nome da Empresa *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Clínica Exemplo"
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="clinica-exemplo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador único usado internamente. Gerado automaticamente.
                  </p>
                  {isEditing && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      ⚠️ Alterar o slug pode afetar integrações existentes
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="document">CNPJ/CPF</Label>
                  <Input
                    id="document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder="00.000.000/0001-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan">Plano *</Label>
                  <Select
                    value={formData.plan}
                    onValueChange={(value) => setFormData({ ...formData, plan: value })}
                  >
                    <SelectTrigger id="plan">
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_users">Máximo de Usuários *</Label>
                  <Input
                    id="max_users"
                    type="number"
                    min={1}
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
              </div>

              {/* Admin Section */}
              <Separator className="my-6" />
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  <h3 className="text-lg font-medium">
                    {isEditing ? 'Adicionar Novo Administrador' : 'Administrador Inicial'}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isEditing 
                    ? 'Adicione um novo usuário administrador para esta empresa. Deixe os campos em branco se não quiser criar um novo usuário.'
                    : 'Crie o primeiro usuário administrador para esta empresa. Este usuário terá acesso total ao sistema.'
                  }
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="admin_name">Nome Completo {!isEditing && '*'}</Label>
                    <Input
                      id="admin_name"
                      value={adminData.full_name}
                      onChange={(e) => setAdminData({ ...adminData, full_name: e.target.value })}
                      placeholder="Nome do administrador"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="admin_email">Email {!isEditing && '*'}</Label>
                    <Input
                      id="admin_email"
                      type="email"
                      value={adminData.email}
                      onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                      placeholder="admin@empresa.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin_password">Senha {!isEditing && '*'}</Label>
                    <Input
                      id="admin_password"
                      type="password"
                      value={adminData.password}
                      onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin_confirm_password">Confirmar Senha {!isEditing && '*'}</Label>
                    <Input
                      id="admin_confirm_password"
                      type="password"
                      value={adminData.confirmPassword}
                      onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                      placeholder="Repita a senha"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/super-admin/tenants')}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCreatingAdmin ? 'Criando administrador...' : 'Salvando...'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isEditing ? 'Salvar Alterações' : 'Criar Empresa'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
