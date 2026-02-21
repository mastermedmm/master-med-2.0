import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLicenseeAuth } from '@/contexts/LicenseeAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Handshake, TrendingUp, Users, RefreshCw, CalendarDays, Ban } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

interface DoctorEntry {
  id: string;
  name: string;
  crm: string;
  cpf: string;
  grossBilling: number;
  netAmount: number;
  paidAmount: number;
  commission: number;
  allocationCount: number;
}

interface Summary {
  totalBilling: number;
  totalCommission: number;
  totalCancelled: number;
}

const SESSION_KEY = 'licensee_portal_session';

export default function LicenseeDashboard() {
  const navigate = useNavigate();
  const { licensee, tenant, logout, loading: authLoading, mustChangePassword } = useLicenseeAuth();
  const { toast } = useToast();
  const [doctors, setDoctors] = useState<DoctorEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  useEffect(() => {
    if (!authLoading && !licensee) navigate(ROUTES.licenseePortal.login, { replace: true });
  }, [authLoading, licensee, navigate]);

  useEffect(() => {
    if (!authLoading && licensee && mustChangePassword) navigate(ROUTES.licenseePortal.changePassword, { replace: true });
  }, [authLoading, licensee, mustChangePassword, navigate]);

  useEffect(() => {
    if (licensee && !mustChangePassword) loadData();
  }, [licensee, mustChangePassword, selectedMonth, selectedYear]);

  const getToken = () => localStorage.getItem(SESSION_KEY);

  const loadData = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const { data, error } = await supabase.functions.invoke('licensee-portal-data', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'doctors', month: parseInt(selectedMonth), year: parseInt(selectedYear) },
      });

      if (error) {
        console.error('Error loading data:', error);
        toast({ title: 'Erro ao carregar dados', description: 'Tente novamente mais tarde', variant: 'destructive' });
      } else if (data && !data.error) {
        setDoctors(data.doctors || []);
        setSummary(data.summary || null);
        setCommissionRate(data.commissionRate || 0);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadData(); };
  const handleLogout = async () => { await logout(); navigate(ROUTES.licenseePortal.login, { replace: true }); };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (authLoading || (!licensee && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Handshake className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{tenant?.name || 'Portal do Licenciado'}</h1>
                <p className="text-sm text-gray-500">{licensee?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Month/Year Filter */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] sm:w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Médicos Vinculados</CardTitle>
                  <Users className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-amber-700">{doctors.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Médicos em sua carteira</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">% Faturando</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-purple-700">
                    {doctors.length > 0
                      ? `${Math.round((doctors.filter(d => d.allocationCount > 0).length / doctors.length) * 100)}%`
                      : '0%'}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {doctors.filter(d => d.allocationCount > 0).length} de {doctors.length} médicos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Faturamento Total</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-blue-700">{formatCurrency(summary?.totalBilling || 0)}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Faturamento bruto dos médicos</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Comissão Total ({commissionRate}%)</CardTitle>
                  <Handshake className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-green-700">{formatCurrency(summary?.totalCommission || 0)}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Sua comissão sobre o faturamento</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Cancelado</CardTitle>
                  <Ban className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-red-700">{formatCurrency(summary?.totalCancelled || 0)}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Notas canceladas no período</p>
                </CardContent>
              </Card>
            </div>

            {/* Doctors Table */}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle className="text-base sm:text-lg">Médicos Vinculados</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {doctors.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum médico vinculado encontrado</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                         <TableHeader>
                          <TableRow>
                            <TableHead>Médico</TableHead>
                            <TableHead>CRM</TableHead>
                            <TableHead className="text-center">Lançamentos</TableHead>
                            <TableHead className="text-right">Faturamento Bruto</TableHead>
                            <TableHead className="text-right">Comissão ({commissionRate}%)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {doctors.map((doctor) => (
                            <TableRow key={doctor.id}>
                              <TableCell className="font-medium">{doctor.name}</TableCell>
                              <TableCell>{doctor.crm}</TableCell>
                              <TableCell className="text-center">{doctor.allocationCount}</TableCell>
                              <TableCell className="text-right">{formatCurrency(doctor.grossBilling)}</TableCell>
                              <TableCell className="text-right font-semibold text-green-700">{formatCurrency(doctor.commission)}</TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow className="border-t-2 font-bold">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-center">{doctors.reduce((s, d) => s + d.allocationCount, 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(summary?.totalBilling || 0)}</TableCell>
                            <TableCell className="text-right text-green-700">{formatCurrency(summary?.totalCommission || 0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                      {doctors.map((doctor) => (
                        <div key={doctor.id} className="rounded-lg border p-3 space-y-2">
                          <div className="font-semibold">{doctor.name}</div>
                          <div className="text-sm text-muted-foreground">CRM: {doctor.crm}</div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Lançamentos:</span>
                              <div className="font-medium">{doctor.allocationCount}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Faturamento:</span>
                              <div className="font-medium">{formatCurrency(doctor.grossBilling)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Comissão:</span>
                              <div className="font-semibold text-green-700">{formatCurrency(doctor.commission)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
