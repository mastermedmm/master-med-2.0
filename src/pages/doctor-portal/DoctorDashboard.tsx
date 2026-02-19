import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDoctorAuth } from '@/contexts/DoctorAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  LogOut, 
  Stethoscope, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Summary {
  faturando: number;
  recebido: number;
  atrasado: number;
}

interface Entry {
  id: string;
  invoiceId: string;
  issueDate: string;
  company: string;
  hospital: string;
  invoiceNumber: string;
  grossValue: number;
  allocatedNetValue: number;
  adminFee: number;
  amountToPay: number;
  paidAmount: number;
  remainingAmount: number;
  expectedPaymentDate: string | null;
  paidAt: string | null;
  status: string;
}

const SESSION_KEY = 'doctor_portal_session';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { doctor, tenant, logout, loading: authLoading, mustChangePassword } = useDoctorAuth();
  const { toast } = useToast();
  
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [anticipateLink, setAnticipateLink] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  
  // Filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());

  // Generate year options from actual entries data
  const yearOptions = useMemo(() => {
    const yearsSet = new Set<string>();
    entries.forEach((entry) => {
      if (entry.issueDate) {
        const year = new Date(entry.issueDate).getFullYear().toString();
        yearsSet.add(year);
      }
    });
    // Sort descending and fallback to current year if no entries
    const years = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
    return years.length > 0 ? years : [currentDate.getFullYear().toString()];
  }, [entries]);

  // Update selectedYear if it's not in the available options
  useEffect(() => {
    if (yearOptions.length > 0 && !yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0]);
    }
  }, [yearOptions]);

  const monthOptions = [
    { value: 'all', label: 'Todos' },
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  // Filtered entries based on month/year selection
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!entry.issueDate) return false;
      const entryDate = new Date(entry.issueDate);
      const entryYear = entryDate.getFullYear().toString();
      const entryMonth = (entryDate.getMonth() + 1).toString().padStart(2, '0');

      const yearMatch = entryYear === selectedYear;
      const monthMatch = selectedMonth === 'all' || entryMonth === selectedMonth;

      return yearMatch && monthMatch;
    });
  }, [entries, selectedMonth, selectedYear]);

  const clearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear(currentDate.getFullYear().toString());
  };

  const hasActiveFilters = selectedMonth !== 'all';

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !doctor) {
      navigate(ROUTES.doctorPortal.login, { replace: true });
    }
  }, [authLoading, doctor, navigate]);

  // Redirect if must change password
  useEffect(() => {
    if (!authLoading && doctor && mustChangePassword) {
      navigate(ROUTES.doctorPortal.changePassword, { replace: true });
    }
  }, [authLoading, doctor, mustChangePassword, navigate]);

  useEffect(() => {
    if (doctor && !mustChangePassword) {
      loadData();
    }
  }, [doctor, mustChangePassword]);

  const getToken = () => localStorage.getItem(SESSION_KEY);

  const loadData = async () => {
    const token = getToken();
    if (!token) return;

    try {
      // Load summary, entries and settings in parallel via edge function
      const [summaryRes, entriesRes, settingsRes] = await Promise.all([
        supabase.functions.invoke('doctor-portal-data', {
          headers: { Authorization: `Bearer ${token}` },
          body: { action: 'summary' },
        }),
        supabase.functions.invoke('doctor-portal-data', {
          headers: { Authorization: `Bearer ${token}` },
          body: { action: 'entries' },
        }),
        supabase.functions.invoke('doctor-portal-data', {
          headers: { Authorization: `Bearer ${token}` },
          body: { action: 'settings' },
        }),
      ]);

      if (summaryRes.error) {
        console.error('Error loading summary:', summaryRes.error);
      } else if (summaryRes.data && !summaryRes.data.error) {
        setSummary(summaryRes.data);
      }

      if (entriesRes.error) {
        console.error('Error loading entries:', entriesRes.error);
      } else if (entriesRes.data && !entriesRes.data.error) {
        setEntries(entriesRes.data.entries || []);
      }

      // Set anticipate link and banner from settings (now from edge function)
      if (settingsRes.error || (settingsRes.data && (settingsRes.data as any).error)) {
        console.error('Error loading portal settings:', settingsRes.error || (settingsRes.data as any).error);
        toast({
          title: 'Erro ao carregar banner',
          description: 'Não foi possível carregar as configurações do Portal do Médico.',
          variant: 'destructive',
        });
      } else if (settingsRes.data) {
        if (settingsRes.data.link) {
          setAnticipateLink(settingsRes.data.link);
        }
        if (settingsRes.data.banner) {
          setBannerUrl(settingsRes.data.banner);
          setBannerLoadError(false);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.doctorPortal.login, { replace: true });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pago</Badge>;
      case 'atrasado':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Atrasado</Badge>;
      case 'pendente':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendente</Badge>;
      case 'parcialmente_pago':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Parcial</Badge>;
      case 'aguardando_recebimento':
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Aguardando</Badge>;
    }
  };

  if (authLoading || (!doctor && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{tenant?.name || 'Portal do Médico'}</h1>
                <p className="text-sm text-gray-500">{doctor?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            {/* Clickable Banner */}
            {bannerUrl && (
              anticipateLink ? (
                <a 
                  href={anticipateLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full mb-4 sm:mb-6 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                >
                  {!bannerLoadError ? (
                    <img 
                      src={bannerUrl} 
                      alt="Banner promocional"
                      className="w-full h-auto object-cover max-h-32 sm:max-h-48 md:max-h-56 lg:max-h-64"
                      onLoad={() => setBannerLoadError(false)}
                      onError={() => setBannerLoadError(true)}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full px-4 py-6 bg-muted text-muted-foreground text-sm">
                      Não foi possível carregar o banner. Tente atualizar a página ou reenvie a imagem em Configurações.
                    </div>
                  )}
                </a>
              ) : (
                <div className="block w-full mb-4 sm:mb-6 rounded-lg overflow-hidden shadow-md">
                  {!bannerLoadError ? (
                    <img 
                      src={bannerUrl} 
                      alt="Banner promocional"
                      className="w-full h-auto object-cover max-h-32 sm:max-h-48 md:max-h-56 lg:max-h-64"
                      onLoad={() => setBannerLoadError(false)}
                      onError={() => setBannerLoadError(true)}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full px-4 py-6 bg-muted text-muted-foreground text-sm">
                      Não foi possível carregar o banner. Tente atualizar a página ou reenvie a imagem em Configurações.
                    </div>
                  )}
                </div>
              )
            )}

            {/* Summary Cards - Mobile Optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
              <Card className="border-l-4 border-l-teal-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Faturando
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-teal-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-teal-700">
                    {formatCurrency(summary?.faturando || 0)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Saldo líquido a receber
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Recebido
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-green-700">
                    {formatCurrency(summary?.recebido || 0)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Total recebido
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Atrasado
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="text-lg sm:text-2xl font-bold text-red-700">
                    {formatCurrency(summary?.atrasado || 0)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Em atraso
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Entries - Mobile Cards / Desktop Table */}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base sm:text-lg">Lançamentos</CardTitle>
                  
                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-[100px] sm:w-[120px] h-8 text-xs">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((month) => (
                          <SelectItem key={month.value} value={month.value} className="text-xs">
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-[80px] h-8 text-xs">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year} className="text-xs">
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={clearFilters}
                        title="Limpar filtros"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground">
                    <Stethoscope className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-sm sm:text-base">Nenhum lançamento encontrado</p>
                    <p className="text-xs sm:text-sm">Seus lançamentos aparecerão aqui</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card Layout */}
                    <div className="sm:hidden space-y-3">
                      {filteredEntries.map((entry) => (
                        <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-muted-foreground">{formatDate(entry.issueDate)}</p>
                              <p className="font-mono text-sm">Nota {entry.invoiceNumber}</p>
                            </div>
                            {getStatusBadge(entry.status)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate" title={entry.hospital}>
                            {entry.hospital}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <div>
                              <p className="text-[10px] text-muted-foreground">A Receber</p>
                              <p className="font-mono font-semibold text-sm">{formatCurrency(entry.amountToPay)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Previsão</p>
                              <p className="text-xs">{formatDate(entry.expectedPaymentDate)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Pago</p>
                              <p className="font-mono text-sm text-green-600">{formatCurrency(entry.paidAmount)}</p>
                            </div>
                            {entry.paidAt && (
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground">Dt. Pgto</p>
                                <p className="text-xs">{formatDate(entry.paidAt)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop: Table Layout */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs">Nº Nota</TableHead>
                            <TableHead className="text-xs">Hospital</TableHead>
                            <TableHead className="text-xs text-right">A Receber</TableHead>
                            <TableHead className="text-xs">Previsão</TableHead>
                            <TableHead className="text-xs text-right">Pago</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Dt. Pgto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs py-2">{formatDate(entry.issueDate)}</TableCell>
                              <TableCell className="font-mono text-xs py-2">{entry.invoiceNumber}</TableCell>
                              <TableCell className="max-w-[150px] truncate text-xs py-2" title={entry.hospital}>
                                {entry.hospital}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-xs py-2">
                                {formatCurrency(entry.amountToPay)}
                              </TableCell>
                              <TableCell className="text-xs py-2">{formatDate(entry.expectedPaymentDate)}</TableCell>
                              <TableCell className="text-right font-mono text-green-600 text-xs py-2">
                                {formatCurrency(entry.paidAmount)}
                              </TableCell>
                              <TableCell className="py-2">{getStatusBadge(entry.status)}</TableCell>
                              <TableCell className="text-xs py-2">{formatDate(entry.paidAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
