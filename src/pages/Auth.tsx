import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAvailableTenants, type AvailableTenant } from '@/hooks/useAvailableTenants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TenantSelector } from '@/components/auth/TenantSelector';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type AuthStep = 'login' | 'select-tenant';

export default function Auth() {
  const { user, loading, signIn, signOut } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { tenants, loading: tenantsLoading } = useAvailableTenants();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // After login, check if user needs to select tenant
  useEffect(() => {
    if (user && !tenantsLoading && tenants.length > 1 && !tenant) {
      setAuthStep('select-tenant');
    }
  }, [user, tenantsLoading, tenants, tenant]);

  if (loading || (user && (tenantLoading || tenantsLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User logged in and has tenant selected
  if (user && tenant) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  // User logged in with single tenant but tenant not loaded yet
  if (user && tenants.length === 1 && !tenant) {
    // Auto-select the single tenant
    const autoSelectTenant = async () => {
      await supabase
        .from('profiles')
        .update({ active_tenant_id: tenants[0].tenant_id })
        .eq('user_id', user.id);
      window.location.reload();
    };
    autoSelectTenant();
    
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
        variant: 'destructive',
      });
      setIsSubmitting(false);
    } else {
      // Login successful - component will re-render and check tenant count
      setIsSubmitting(false);
    }
  };

  const handleTenantSelect = async (tenantId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active_tenant_id: tenantId })
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: 'Erro ao selecionar empresa',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // Reload to apply the tenant selection
      window.location.reload();
    } catch (error) {
      console.error('Error selecting tenant:', error);
      toast({
        title: 'Erro ao selecionar empresa',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive',
      });
    }
  };

  const handleBackToLogin = async () => {
    await signOut();
    setAuthStep('login');
    setLoginEmail('');
    setLoginPassword('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {authStep === 'select-tenant' && tenants.length > 1 ? (
        <TenantSelector
          tenants={tenants}
          onSelect={handleTenantSelect}
          onBack={handleBackToLogin}
        />
      ) : (
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <FileUp className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground">MASTERSYSTEM</h1>
            <p className="mt-1 text-muted-foreground">Sistema de gestão financeira</p>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-center">Entrar</CardTitle>
              <CardDescription className="text-center">
                Acesse sua conta para continuar
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
