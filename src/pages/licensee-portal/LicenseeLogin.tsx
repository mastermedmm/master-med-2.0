import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLicenseeAuth } from '@/contexts/LicenseeAuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Handshake, Building2, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

export default function LicenseeLogin() {
  const navigate = useNavigate();
  const { login, licensee, loading: authLoading } = useLicenseeAuth();
  const { toast } = useToast();
  
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTenantSelection, setShowTenantSelection] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [storedCredentials, setStoredCredentials] = useState<{ cpf: string; password: string } | null>(null);

  if (!authLoading && licensee) {
    navigate(ROUTES.licenseePortal.dashboard, { replace: true });
    return null;
  }

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf.trim() || !password) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha o CPF e a senha', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const result = await login(cpf.replace(/\D/g, ''), password);

    if (result.error) {
      toast({ title: 'Erro no login', description: result.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (result.requiresTenantSelection && result.tenants) {
      setStoredCredentials({ cpf: cpf.replace(/\D/g, ''), password });
      setAvailableTenants(result.tenants);
      setShowTenantSelection(true);
      setLoading(false);
      return;
    }

    if (result.mustChangePassword) {
      navigate(ROUTES.licenseePortal.changePassword, { replace: true });
    } else {
      navigate(ROUTES.licenseePortal.dashboard, { replace: true });
    }
  };

  const handleTenantSelect = async (tenantId: string) => {
    if (!storedCredentials) return;
    setLoading(true);
    const result = await login(storedCredentials.cpf, storedCredentials.password, tenantId);

    if (result.error) {
      toast({ title: 'Erro no login', description: result.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (result.mustChangePassword) {
      navigate(ROUTES.licenseePortal.changePassword, { replace: true });
    } else {
      navigate(ROUTES.licenseePortal.dashboard, { replace: true });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (showTenantSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-amber-800">Selecione a Empresa</CardTitle>
              <CardDescription className="text-amber-600">Selecione qual empresa deseja acessar:</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableTenants.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                className="w-full h-auto py-4 px-4 flex flex-col items-start gap-1 hover:bg-amber-50 hover:border-amber-300"
                onClick={() => handleTenantSelect(t.id)}
                disabled={loading}
              >
                <span className="font-semibold text-foreground">{t.name}</span>
                <span className="text-sm text-muted-foreground">@{t.slug}</span>
              </Button>
            ))}
            <Button variant="ghost" className="w-full mt-4" onClick={() => { setShowTenantSelection(false); setPassword(''); }} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao login
            </Button>
            {loading && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <Handshake className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-amber-800">Portal do Licenciado</CardTitle>
            <CardDescription className="text-amber-600">Acesse seu portal para acompanhar suas comissões</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
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
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={loading}>
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>) : 'Entrar'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <a href={ROUTES.auth} className="text-sm text-muted-foreground hover:text-amber-600 transition-colors">
              Acesso administrativo →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
