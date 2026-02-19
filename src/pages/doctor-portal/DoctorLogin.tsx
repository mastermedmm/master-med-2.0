import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDoctorAuth } from '@/contexts/DoctorAuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Stethoscope, Building2, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

export default function DoctorLogin() {
  const navigate = useNavigate();
  const { login, doctor, loading: authLoading } = useDoctorAuth();
  const { toast } = useToast();
  
  const [crm, setCrm] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Tenant selection state
  const [showTenantSelection, setShowTenantSelection] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [storedCredentials, setStoredCredentials] = useState<{ crm: string; password: string } | null>(null);

  // Redirect if already logged in
  if (!authLoading && doctor) {
    navigate(ROUTES.doctorPortal.dashboard, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!crm.trim() || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o CRM e a senha',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const result = await login(crm.trim(), password);

    if (result.error) {
      toast({
        title: 'Erro no login',
        description: result.error,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Check if tenant selection is required
    if (result.requiresTenantSelection && result.tenants) {
      setStoredCredentials({ crm: crm.trim(), password });
      setAvailableTenants(result.tenants);
      setShowTenantSelection(true);
      setLoading(false);
      return;
    }

    if (result.mustChangePassword) {
      navigate(ROUTES.doctorPortal.changePassword, { replace: true });
    } else {
      navigate(ROUTES.doctorPortal.dashboard, { replace: true });
    }
  };

  const handleTenantSelect = async (tenantId: string) => {
    if (!storedCredentials) return;
    
    setLoading(true);

    const result = await login(storedCredentials.crm, storedCredentials.password, tenantId);

    if (result.error) {
      toast({
        title: 'Erro no login',
        description: result.error,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (result.mustChangePassword) {
      navigate(ROUTES.doctorPortal.changePassword, { replace: true });
    } else {
      navigate(ROUTES.doctorPortal.dashboard, { replace: true });
    }
  };

  const handleBackToLogin = () => {
    setShowTenantSelection(false);
    setAvailableTenants([]);
    setStoredCredentials(null);
    setPassword('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // Tenant selection screen
  if (showTenantSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-teal-800">Selecione a Empresa</CardTitle>
              <CardDescription className="text-teal-600">
                Você está cadastrado em mais de uma empresa. Selecione qual deseja acessar:
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableTenants.map((tenant) => (
              <Button
                key={tenant.id}
                variant="outline"
                className="w-full h-auto py-4 px-4 flex flex-col items-start gap-1 hover:bg-teal-50 hover:border-teal-300"
                onClick={() => handleTenantSelect(tenant.id)}
                disabled={loading}
              >
                <span className="font-semibold text-foreground">{tenant.name}</span>
                <span className="text-sm text-muted-foreground">@{tenant.slug}</span>
              </Button>
            ))}
            
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={handleBackToLogin}
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Button>
            
            {loading && (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
            <Stethoscope className="h-8 w-8 text-teal-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-teal-800">Portal do Médico</CardTitle>
            <CardDescription className="text-teal-600">
              Acesse seu portal para acompanhar seus recebimentos
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="crm">CRM</Label>
              <Input
                id="crm"
                type="text"
                placeholder="12345/PE"
                value={crm}
                onChange={(e) => setCrm(e.target.value.toUpperCase())}
                className="uppercase"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <a 
              href={ROUTES.auth} 
              className="text-sm text-muted-foreground hover:text-teal-600 transition-colors"
            >
              Acesso administrativo →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
