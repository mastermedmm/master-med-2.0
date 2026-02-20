import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, TrendingUp, TrendingDown, Scale, Filter, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Adjustment {
  id: string;
  adjustment_type: 'recebimento' | 'pagamento';
  expected_amount: number;
  received_amount: number;
  adjustment_amount: number;
  adjustment_date: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  invoice_id: string | null;
  account_payable_id: string | null;
  bank_id: string | null;
  banks?: { name: string } | null;
  invoices?: { invoice_number: string; hospital_name: string } | null;
}

interface Bank {
  id: string;
  name: string;
}

export default function ReceiptPaymentAdjustments() {
  const { tenantId } = useTenant();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    if (tenantId) {
      loadBanks();
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadAdjustments();
    }
  }, [tenantId, filterType, filterBank, filterStartDate, filterEndDate]);

  const loadBanks = async () => {
    const { data } = await supabase
      .from('banks')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name');
    setBanks(data || []);
  };

  const loadAdjustments = async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('receipt_payment_adjustments')
      .select(`
        *,
        banks(name),
        invoices(invoice_number, hospital_name)
      `)
      .eq('tenant_id', tenantId)
      .order('adjustment_date', { ascending: false });

    if (filterType !== 'all') {
      query = query.eq('adjustment_type', filterType);
    }
    if (filterBank !== 'all') {
      query = query.eq('bank_id', filterBank);
    }
    if (filterStartDate) {
      query = query.gte('adjustment_date', filterStartDate);
    }
    if (filterEndDate) {
      query = query.lte('adjustment_date', filterEndDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading adjustments:', error);
    }

    setAdjustments((data || []) as unknown as Adjustment[]);
    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Calculate totals
  const positiveTotal = adjustments
    .filter(a => a.adjustment_amount > 0)
    .reduce((sum, a) => sum + a.adjustment_amount, 0);
  
  const negativeTotal = adjustments
    .filter(a => a.adjustment_amount < 0)
    .reduce((sum, a) => sum + a.adjustment_amount, 0);
  
  const netTotal = positiveTotal + negativeTotal;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ajustes de Recebimento e Pagamento</h1>
            <p className="text-muted-foreground">
              Registro de diferenças entre valores esperados e recebidos
            </p>
          </div>
          <Button variant="outline" onClick={loadAdjustments} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Ajustes Positivos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(positiveTotal)}
              </p>
              <p className="text-xs text-muted-foreground">Recebeu mais que o esperado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Ajustes Negativos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(negativeTotal)}
              </p>
              <p className="text-xs text-muted-foreground">Recebeu menos que o esperado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Saldo de Ajustes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${netTotal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(netTotal)}
              </p>
              <p className="text-xs text-muted-foreground">Total líquido de ajustes</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-lg">Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="recebimento">Recebimento</SelectItem>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={filterBank} onValueChange={setFilterBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os bancos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os bancos</SelectItem>
                    {banks.map(bank => (
                      <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adjustments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Ajustes</CardTitle>
            <CardDescription>
              {adjustments.length} ajustes encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {adjustments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum ajuste encontrado</p>
                <p className="text-sm">Ajustes são criados ao vincular transações com valores diferentes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>NF / Lançamento</TableHead>
                      <TableHead className="text-right">Valor Esperado</TableHead>
                      <TableHead className="text-right">Valor Recebido</TableHead>
                      <TableHead className="text-right">Ajuste</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Banco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map(adjustment => (
                      <TableRow key={adjustment.id}>
                        <TableCell>
                          {format(new Date(adjustment.adjustment_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={adjustment.adjustment_type === 'recebimento' ? 'default' : 'secondary'}>
                            {adjustment.adjustment_type === 'recebimento' ? 'Recebimento' : 'Pagamento'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {adjustment.invoices ? (
                            <span>NF {adjustment.invoices.invoice_number} - {adjustment.invoices.hospital_name}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(adjustment.expected_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(adjustment.received_amount)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          adjustment.adjustment_amount >= 0 ? 'text-emerald-600' : 'text-destructive'
                        }`}>
                          {adjustment.adjustment_amount >= 0 ? '+' : ''}
                          {formatCurrency(adjustment.adjustment_amount)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={adjustment.reason || ''}>
                          {adjustment.reason || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {adjustment.banks?.name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
