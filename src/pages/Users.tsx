import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserCog, Shield, User, MoreHorizontal, Pencil, Key, UserPlus } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  created_at: string;
  role?: string;
  email?: string;
}

type DialogType = 'edit' | 'password' | 'create' | null;

export default function Users() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { tenantId } = useTenant();
  const { isAdmin, canCreate } = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<string>('operador');
  
  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Create user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('operador');

  useEffect(() => {
    if (tenantId) {
      loadUsers();
    }
  }, [tenantId]);

  const loadUsers = async () => {
    if (!tenantId) return;
    
    try {
      // Get user_roles for current tenant first
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('tenant_id', tenantId);

      if (rolesError) throw rolesError;

      const userIds = (roles || []).map(r => r.user_id);
      
      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get profiles only for users in this tenant
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const rolesMap = (roles || []).reduce((acc, r) => {
        acc[r.user_id] = r.role;
        return acc;
      }, {} as Record<string, string>);

      // Fetch emails via edge function
      let emailsMap: Record<string, string> = {};
      try {
        const { data: emailsData, error: emailsError } = await supabase.functions.invoke('update-user', {
          body: { action: 'list-emails' },
        });
        if (emailsError) {
          console.error('Error fetching emails from edge function:', emailsError);
        } else if (emailsData?.users) {
          emailsMap = emailsData.users;
        } else {
          console.warn('No email data returned:', emailsData);
        }
      } catch (e) {
        console.error('Error fetching emails:', e);
      }

      const usersWithRoles = (profiles || []).map(p => ({
        ...p,
        role: rolesMap[p.user_id] || 'operador',
        email: emailsMap[p.user_id] || '',
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: 'Erro ao carregar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditName(user.full_name);
    setEditEmail(user.email || '');
    setEditRole(user.role || 'operador');
    setDialogType('edit');
  };

  const openPasswordDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setDialogType('password');
  };

  const openCreateDialog = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('operador');
    setDialogType('create');
  };

  const closeDialog = () => {
    setDialogType(null);
    setSelectedUser(null);
  };

  const handleEditSave = async () => {
    if (!selectedUser) return;
    
    if (!editName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe o nome do usuário.',
        variant: 'destructive',
      });
      return;
    }

    // Validate email if provided
    if (editEmail && !editEmail.includes('@')) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, informe um email válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Use edge function for admin operations
      const response = await supabase.functions.invoke('update-user', {
        body: {
          targetUserId: selectedUser.user_id,
          fullName: editName.trim(),
          email: editEmail.trim() || undefined,
          role: isAdmin && selectedUser.user_id !== currentUser?.id ? editRole as 'admin' | 'operador' | 'financeiro' : undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Usuário atualizado',
        description: 'As informações foram salvas com sucesso.',
      });

      closeDialog();
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedUser) return;

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    // Only allow changing own password or if admin
    const isOwnPassword = currentUser?.id === selectedUser.user_id;
    
    if (!isOwnPassword && !isAdmin) {
      toast({
        title: 'Sem permissão',
        description: 'Você só pode alterar sua própria senha.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (isOwnPassword) {
        // Change own password using updateUser
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
      } else {
        // Admin changing another user's password via edge function
        const response = await supabase.functions.invoke('update-user', {
          body: {
            targetUserId: selectedUser.user_id,
            password: newPassword,
          },
        });
        if (response.error) throw new Error(response.error.message);
        if (response.data?.error) throw new Error(response.data.error);
      }

      toast({
        title: 'Senha alterada',
        description: 'A senha foi atualizada com sucesso.',
      });

      closeDialog();
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    if (newUserPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail.trim(),
        password: newUserPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: newUserName.trim() }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Wait a moment for triggers to create the default profile/role
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Associate user with current tenant
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ tenant_id: tenantId, active_tenant_id: tenantId })
          .eq('user_id', authData.user.id);

        if (profileError) {
          console.error('Error updating profile tenant:', profileError);
        }

        // Update role and tenant_id in user_roles
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ 
            role: newUserRole as 'admin' | 'operador' | 'financeiro',
            tenant_id: tenantId 
          })
          .eq('user_id', authData.user.id);

        if (roleError) {
          console.error('Error updating role:', roleError);
        }
      }

      toast({
        title: 'Usuário criado',
        description: 'O novo usuário foi cadastrado com sucesso.',
      });

      closeDialog();
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'Este email já está cadastrado no sistema.';
      }
      
      toast({
        title: 'Erro ao criar usuário',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Shield className="h-3 w-3" />
          Admin
        </span>
      );
    }
    if (role === 'financeiro') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
          <User className="h-3 w-3" />
          Financeiro
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <User className="h-3 w-3" />
        Operador
      </span>
    );
  };

  const canEditUser = (user: UserProfile) => {
    // Can edit own profile or if admin
    return currentUser?.id === user.user_id || isAdmin;
  };

  const canChangePassword = (user: UserProfile) => {
    // Can change own password or if admin
    return currentUser?.id === user.user_id || isAdmin;
  };

  return (
    <AppLayout>
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-description">Gerenciamento de usuários do sistema</p>
        </div>
        {canCreate('users') && (
          <Button onClick={openCreateDialog} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>
            Usuários que têm acesso ao sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UserCog className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name}
                      {currentUser?.id === user.user_id && (
                        <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email || '—'}</TableCell>
                    <TableCell>{getRoleBadge(user.role || 'operador')}</TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditUser(user) && (
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar Cadastro
                            </DropdownMenuItem>
                          )}
                          {canChangePassword(user) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openPasswordDialog(user)}>
                                <Key className="h-4 w-4 mr-2" />
                                Alterar Senha
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={dialogType === 'edit'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email de Acesso</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter o email atual
              </p>
            </div>
            {isAdmin && selectedUser?.user_id !== currentUser?.id && (
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Perfil</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={dialogType === 'password'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite a nova senha para {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handlePasswordChange} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={dialogType === 'create'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Cadastre um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-name">Nome Completo</Label>
              <Input
                id="new-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-user-password">Senha</Label>
              <Input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-role">Perfil</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
