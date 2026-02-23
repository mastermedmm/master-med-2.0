import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { parseOFX, isValidOFX, generateFileHash, OFXData } from "@/utils/parseOFX";
import { useImportedTransactions } from "@/hooks/useImportedTransactions";
import { ROUTES } from "@/config/routes";
import { 
  Upload, 
  FileText, 
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Check,
  ArrowRight,
} from "lucide-react";

interface Bank {
  id: string;
  name: string;
  agency: string | null;
  account_number: string | null;
}

export default function ImportBankStatement() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { isLoading: isImporting, importOFXTransactions } = useImportedTransactions();

  // State
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [ofxData, setOfxData] = useState<OFXData | null>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Load banks
  useEffect(() => {
    if (!tenantId) return;
    const loadBanks = async () => {
      const { data } = await supabase
        .from('banks')
        .select('id, name, agency, account_number')
        .eq('tenant_id', tenantId)
        .order('name');
      setBanks(data || []);
    };
    loadBanks();
  }, [tenantId]);

  // File handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelected(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelected(selectedFile);
  };

  const handleFileSelected = async (selectedFile: File) => {
    const extension = selectedFile.name.toLowerCase().split('.').pop();
    if (!['ofx', 'ofc'].includes(extension || '')) {
      toast.error('Formato inválido. Use arquivos .OFX ou .OFC');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setImportResult(null);

    try {
      const content = await selectedFile.text();
      
      if (!isValidOFX(content)) {
        toast.error('Arquivo OFX inválido ou corrompido');
        setFile(null);
        return;
      }

      const hash = await generateFileHash(content);
      setFileHash(hash);

      const data = parseOFX(content);
      setOfxData(data);

      toast.success(`${data.transactions.length} transações encontradas`);
    } catch (error) {
      console.error('Error parsing OFX:', error);
      toast.error('Erro ao processar arquivo OFX');
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Import handler
  const handleImport = async () => {
    if (!selectedBankId) {
      toast.error('Selecione um banco');
      return;
    }
    if (!ofxData || ofxData.transactions.length === 0 || !file) {
      toast.error('Nenhuma transação para processar');
      return;
    }

    const result = await importOFXTransactions(
      ofxData.transactions,
      selectedBankId,
      file.name,
      fileHash
    );

    if (result.success) {
      setImportResult({ imported: result.imported, skipped: result.skipped });
    }
  };

  // Helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getTransactionTotals = () => {
    if (!ofxData) return { credits: 0, debits: 0, count: 0 };
    
    return {
      credits: ofxData.transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0),
      debits: ofxData.transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0),
      count: ofxData.transactions.length,
    };
  };

  const totals = getTransactionTotals();

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Importar Extrato Bancário</h1>
            <p className="text-muted-foreground">
              Importe transações do extrato bancário no formato OFX
            </p>
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Check className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200">
                      Importação concluída!
                    </p>
                    <p className="text-green-700 dark:text-green-300">
                      {importResult.imported} transações importadas
                      {importResult.skipped > 0 && `, ${importResult.skipped} já existiam`}
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate(ROUTES.reconcileTransactions)}>
                  Conciliar Transações
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload do Arquivo
              </CardTitle>
              <CardDescription>
                Arraste um arquivo OFX ou clique para selecionar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".ofx,.ofc"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Processando arquivo...</p>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-10 w-10 text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {ofxData?.transactions.length || 0} transações encontradas
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Arraste o arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: .OFX, .OFC
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bank Selection & Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Banco de Destino</CardTitle>
              <CardDescription>
                Selecione o banco ao qual este extrato pertence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um banco" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                      {bank.account_number && ` - ${bank.account_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {ofxData?.account.accountId && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Conta no arquivo: {ofxData.account.accountId}
                    {ofxData.account.branchId && ` | Ag: ${ofxData.account.branchId}`}
                  </AlertDescription>
                </Alert>
              )}

              {ofxData && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Créditos</span>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {formatCurrency(totals.credits)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Débitos</span>
                    </div>
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      {formatCurrency(totals.debits)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Total de transações</span>
                    <Badge>{totals.count}</Badge>
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleImport}
                disabled={!file || !selectedBankId || isProcessing || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Transações
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                As transações serão salvas para conciliação posterior.
                Transações duplicadas serão ignoradas automaticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
