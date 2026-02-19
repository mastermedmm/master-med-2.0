import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { 
  FileUp, 
  Upload, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  FileCode,
  AlertTriangle,
  Files,
  RefreshCw
} from 'lucide-react';
import { parseNFeXML, isXMLFile, NFeData } from '@/utils/parseNFeXMLv2';
import { ScrollArea } from '@/components/ui/scroll-area';
import { extractIssuerCnpjFallback } from '@/utils/extractIssuerCnpjFallback';

interface ImportResult {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'duplicate' | 'updated';
  message?: string;
  invoiceNumber?: string;
  grossValue?: number;
}

export function BulkXMLImport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [updateMode, setUpdateMode] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isXMLFile);
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      setResults([]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(isXMLFile);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      setResults([]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
  };

  const generateHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const findOrCreateIssuer = async (data: NFeData): Promise<string | null> => {
    if (!data.companyCnpj || !tenantId) return null;

    const cnpjClean = data.companyCnpj.replace(/\D/g, '');
    
    const { data: existing } = await supabase
      .from('issuers')
      .select('id')
      .eq('cnpj', cnpjClean)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: newIssuer, error } = await supabase
      .from('issuers')
      .insert({
        tenant_id: tenantId,
        name: data.companyName || 'Emitente',
        cnpj: cnpjClean,
        city: data.companyCity || '',
        state: data.companyState || '',
        iss_rate: data.issPercentage || 0,
      })
      .select('id')
      .single();

    if (error) return null;
    return newIssuer.id;
  };

  const findOrCreateHospital = async (data: NFeData): Promise<string | null> => {
    if (!data.hospitalName || !tenantId) return null;

    const cnpjClean = data.hospitalCnpj?.replace(/\D/g, '') || null;
    
    if (cnpjClean) {
      const { data: byDoc } = await supabase
        .from('hospitals')
        .select('id')
        .eq('document', cnpjClean)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (byDoc) return byDoc.id;
    }

    const { data: byName } = await supabase
      .from('hospitals')
      .select('id')
      .eq('name', data.hospitalName)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (byName) return byName.id;

    const { data: newHospital, error } = await supabase
      .from('hospitals')
      .insert({
        tenant_id: tenantId,
        name: data.hospitalName,
        document: cnpjClean,
      })
      .select('id')
      .single();

    if (error) return null;
    return newHospital.id;
  };

  const processFile = async (file: File, index: number): Promise<ImportResult> => {
    try {
      // Parse XML
      const data = await parseNFeXML(file);

      // Fallback específico (GISS/AL): tenta achar o CNPJ do emitente caso o parser não tenha retornado
      if (!data.companyCnpj) {
        const fallbackCnpj = await extractIssuerCnpjFallback(file);
        if (fallbackCnpj) data.companyCnpj = fallbackCnpj;
      }
      
      // Generate hash
      const hash = await generateHash(file);
      
      // Check for duplicate (pdf_hash is globally unique)
      const { data: existing } = await supabase
        .from('invoices')
        .select('id, tenant_id')
        .eq('pdf_hash', hash)
        .maybeSingle();

      if (existing) {
        const isSameTenant = existing.tenant_id === tenantId;
        
        // Se modo atualização está ativo e é do mesmo tenant, atualiza
        if (updateMode && isSameTenant) {
          // Calculate net value - use XML value or calculate
          const netValue = data.netValueFromXml > 0
            ? data.netValueFromXml
            : data.hasRetention 
              ? (data.grossValue - data.totalDeductions - (data.isIssRetained ? data.issValue : 0)) 
              : data.grossValue;

          // Atualizar registro existente
          const { error: updateError } = await supabase
            .from('invoices')
            .update({
              invoice_type: data.invoiceType || 'ABRASF',
              gross_value: data.grossValue,
              total_deductions: data.totalDeductions,
              iss_value: data.issValue,
              iss_percentage: data.issPercentage,
              irrf_value: data.irrfValue,
              inss_value: data.inssValue,
              csll_value: data.csllValue,
              pis_value: data.pisValue,
              cofins_value: data.cofinsValue,
              net_value: netValue,
              is_iss_retained: data.isIssRetained,
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

          return {
            fileName: file.name,
            status: 'updated',
            message: 'Dados atualizados com sucesso',
            invoiceNumber: data.invoiceNumber,
            grossValue: data.grossValue,
          };
        }

        return {
          fileName: file.name,
          status: 'duplicate',
          message: isSameTenant 
            ? 'Nota já importada anteriormente nesta empresa' 
            : 'Nota já importada em outra empresa',
          invoiceNumber: data.invoiceNumber,
        };
      }

      // Find or create issuer and hospital
      const issuerId = await findOrCreateIssuer(data);
      const hospitalId = await findOrCreateHospital(data);

      // Upload file
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName);

      // Calculate net value - use XML value or calculate
      const netValue = data.netValueFromXml > 0
        ? data.netValueFromXml
        : data.hasRetention 
          ? (data.grossValue - data.totalDeductions - (data.isIssRetained ? data.issValue : 0)) 
          : data.grossValue;

      // Insert invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          pdf_url: urlData.publicUrl,
          pdf_hash: hash,
          invoice_type: data.invoiceType || 'ABRASF',
          company_name: data.companyName,
          issuer_id: issuerId,
          hospital_id: hospitalId,
          hospital_name: data.hospitalName,
          issue_date: data.issueDate,
          invoice_number: data.invoiceNumber,
          gross_value: data.grossValue,
          total_deductions: data.totalDeductions,
          iss_value: data.issValue,
          iss_percentage: data.issPercentage,
          irrf_value: data.irrfValue,
          inss_value: data.inssValue,
          csll_value: data.csllValue,
          pis_value: data.pisValue,
          cofins_value: data.cofinsValue,
          net_value: netValue,
          is_iss_retained: data.isIssRetained,
          expected_receipt_date: data.expectedReceiptDate,
          created_by: user?.id,
          tenant_id: tenantId,
        });

      if (invoiceError) throw invoiceError;

      return {
        fileName: file.name,
        status: 'success',
        message: 'Importado com sucesso',
        invoiceNumber: data.invoiceNumber,
        grossValue: data.grossValue,
      };
    } catch (error: any) {
      return {
        fileName: file.name,
        status: 'error',
        message: error.message || 'Erro ao processar arquivo',
      };
    }
  };

  const handleBulkImport = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    
    const initialResults: ImportResult[] = files.map(f => ({
      fileName: f.name,
      status: 'pending',
    }));
    setResults(initialResults);

    let successCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < files.length; i++) {
      // Update to processing
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'processing' } : r
      ));

      const result = await processFile(files[i], i);
      
      // Update with result
      setResults(prev => prev.map((r, idx) => 
        idx === i ? result : r
      ));

      if (result.status === 'success') successCount++;
      else if (result.status === 'updated') updatedCount++;
      else if (result.status === 'error') errorCount++;
      else if (result.status === 'duplicate') duplicateCount++;

      setProgress(((i + 1) / files.length) * 100);
    }

    setIsProcessing(false);

    const parts = [];
    if (successCount > 0) parts.push(`${successCount} importados`);
    if (updatedCount > 0) parts.push(`${updatedCount} atualizados`);
    if (duplicateCount > 0) parts.push(`${duplicateCount} duplicados`);
    if (errorCount > 0) parts.push(`${errorCount} erros`);

    toast({
      title: 'Importação concluída',
      description: parts.join(', '),
    });
  };

  const getStatusIcon = (status: ImportResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'updated':
        return <RefreshCw className="h-4 w-4 text-primary" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'duplicate':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <FileCode className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ImportResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-success/20 text-success border-0">Importado</Badge>;
      case 'updated':
        return <Badge className="bg-primary/20 text-primary border-0">Atualizado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'duplicate':
        return <Badge className="bg-warning/20 text-warning border-0">Duplicado</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processando...</Badge>;
      default:
        return <Badge variant="outline">Aguardando</Badge>;
    }
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const updatedCount = results.filter(r => r.status === 'updated').length;
  const duplicateCount = results.filter(r => r.status === 'duplicate').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            Importação em Massa
          </CardTitle>
          <CardDescription>
            Arraste múltiplos arquivos XML ou clique para selecionar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Update Mode Toggle */}
          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-muted/30">
            <Switch
              id="update-mode"
              checked={updateMode}
              onCheckedChange={setUpdateMode}
              disabled={isProcessing}
            />
            <div className="space-y-0.5">
              <Label htmlFor="update-mode" className="text-sm font-medium cursor-pointer">
                Atualizar notas já importadas
              </Label>
              <p className="text-xs text-muted-foreground">
                Reimporta dados do XML sobrescrevendo valores (ISS, impostos, valor líquido)
              </p>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              ${files.length > 0 ? 'bg-muted/50' : ''}
            `}
          >
            <input
              type="file"
              accept="text/xml,application/xml,.xml"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
              multiple
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-10 w-10" />
              <span className="font-medium text-sm">
                {files.length > 0 
                  ? `${files.length} arquivo(s) selecionado(s)` 
                  : 'Arraste os XMLs aqui ou clique para selecionar'
                }
              </span>
              <Badge variant="outline" className="text-xs">Múltiplos XMLs</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Files List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Arquivos Selecionados ({files.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAll}
                  disabled={isProcessing}
                >
                  Limpar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleBulkImport}
                  disabled={isProcessing || files.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      {updateMode ? 'Importar/Atualizar Todos' : 'Importar Todos'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isProcessing && (
              <div className="mb-4">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {Math.round(progress)}% concluído
                </p>
              </div>
            )}
            
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {(results.length > 0 ? results : files.map(f => ({ 
                  fileName: f.name, 
                  status: 'pending' as const 
                }))).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[300px]">
                          {item.fileName}
                        </p>
                        {item.message && (
                          <p className="text-xs text-muted-foreground">
                            {item.message}
                          </p>
                        )}
                        {item.invoiceNumber && (
                          <p className="text-xs text-muted-foreground">
                            Nota: {item.invoiceNumber}
                            {item.grossValue && ` • R$ ${item.grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.status)}
                      {!isProcessing && results.length === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Summary after import */}
      {results.length > 0 && !isProcessing && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumo da Importação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-lg bg-success/10">
                <p className="text-2xl font-bold text-success">
                  {successCount}
                </p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10">
                <p className="text-2xl font-bold text-primary">
                  {updatedCount}
                </p>
                <p className="text-sm text-muted-foreground">Atualizados</p>
              </div>
              <div className="p-4 rounded-lg bg-warning/10">
                <p className="text-2xl font-bold text-warning">
                  {duplicateCount}
                </p>
                <p className="text-sm text-muted-foreground">Duplicados</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <p className="text-2xl font-bold text-destructive">
                  {errorCount}
                </p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
