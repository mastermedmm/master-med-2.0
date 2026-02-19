import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { FileUp, Upload, Loader2, CheckCircle, FileCode, Building2, Factory, Files } from 'lucide-react';
import { parseNFeXML, isXMLFile, NFeData } from '@/utils/parseNFeXMLv2';
import { BulkXMLImport } from '@/components/import/BulkXMLImport';
import { extractIssuerCnpjFallback } from '@/utils/extractIssuerCnpjFallback';

const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

export default function ImportXML() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { logEvent } = useAuditLog();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionComplete, setExtractionComplete] = useState(false);
  const [xmlData, setXmlData] = useState<NFeData | null>(null);
  const [autoRegistered, setAutoRegistered] = useState<{ issuer: boolean; hospital: boolean }>({ issuer: false, hospital: false });

  const [formData, setFormData] = useState({
    invoiceType: '' as NFeData['invoiceType'] | '',
    hasRetention: true,
    isIssRetained: true,
    companyName: '',
    companyCnpj: '',
    hospitalName: '',
    hospitalCnpj: '',
    issueDate: '',
    invoiceNumber: '',
    grossValue: '',
    totalDeductions: '',
    issValue: '',
    issPercentage: '',
    irrfValue: '',
    inssValue: '',
    csllValue: '',
    pisValue: '',
    cofinsValue: '',
    expectedReceiptDate: '',
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const resetForm = () => {
    setFormData({
      invoiceType: '',
      hasRetention: true,
      isIssRetained: true,
      companyName: '',
      companyCnpj: '',
      hospitalName: '',
      hospitalCnpj: '',
      issueDate: '',
      invoiceNumber: '',
      grossValue: '',
      totalDeductions: '',
      issValue: '',
      issPercentage: '',
      irrfValue: '',
      inssValue: '',
      csllValue: '',
      pisValue: '',
      cofinsValue: '',
      expectedReceiptDate: '',
    });
    setXmlData(null);
    setAutoRegistered({ issuer: false, hospital: false });
  };

  const extractDataFromXML = async (file: File) => {
    setIsExtracting(true);
    
    try {
      const data = await parseNFeXML(file);

      // Fallback específico (GISS/AL): tenta achar o CNPJ do emitente caso o parser não tenha retornado
      if (!data.companyCnpj) {
        const fallbackCnpj = await extractIssuerCnpjFallback(file);
        if (fallbackCnpj) data.companyCnpj = fallbackCnpj;
      }

      setXmlData(data);
      
      const formatValue = (value: number) => {
        if (!value) return '';
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      setFormData({
        invoiceType: data.invoiceType,
        hasRetention: data.hasRetention,
        isIssRetained: data.isIssRetained,
        companyName: data.companyName || '',
        companyCnpj: data.companyCnpj || '',
        hospitalName: data.hospitalName || '',
        hospitalCnpj: data.hospitalCnpj || '',
        issueDate: data.issueDate || '',
        invoiceNumber: data.invoiceNumber || '',
        grossValue: formatValue(data.grossValue),
        totalDeductions: formatValue(data.hasRetention ? data.totalDeductions : 0),
        issValue: formatValue(data.issValue || 0),
        issPercentage: formatValue(data.issPercentage || 0),
        irrfValue: formatValue(data.irrfValue || 0),
        inssValue: formatValue(data.inssValue || 0),
        csllValue: formatValue(data.csllValue || 0),
        pisValue: formatValue(data.pisValue || 0),
        cofinsValue: formatValue(data.cofinsValue || 0),
        expectedReceiptDate: data.expectedReceiptDate || '',
      });

      if (!data.hasRetention) {
        toast({
          title: 'Nota sem retenção',
          description: 'O valor líquido do XML é igual ao bruto. Retenções serão apenas informativas.',
        });
      }

      setExtractionComplete(true);
      toast({
        title: 'Dados importados do XML',
        description: 'Valores extraídos. Emitente e hospital serão cadastrados automaticamente.',
      });
    } catch (error: any) {
      console.error('Error parsing XML:', error);
      toast({
        title: 'Erro ao ler XML',
        description: error.message || 'Não foi possível extrair os dados do XML.',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (!isXMLFile(selectedFile)) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo XML de NF-e',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setExtractionComplete(false);
    resetForm();
    await extractDataFromXML(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    
    if (droppedFile && isXMLFile(droppedFile)) {
      handleFileSelected(droppedFile);
    } else {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo XML de NF-e',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelected(selectedFile);
    }
  };

  const calculateNetValue = () => {
    // Usar o valor líquido diretamente do XML se disponível
    if (xmlData?.netValueFromXml && xmlData.netValueFromXml > 0) {
      return xmlData.netValueFromXml;
    }
    
    const gross = parseFloat(formData.grossValue.replace(/\./g, '').replace(',', '.')) || 0;
    if (!formData.hasRetention) {
      return gross;
    }
    const deductions = parseFloat(formData.totalDeductions.replace(/\./g, '').replace(',', '.')) || 0;
    const issVal = formData.isIssRetained ? (parseFloat(formData.issValue.replace(/\./g, '').replace(',', '.')) || 0) : 0;
    return gross - deductions - issVal;
  };

  const formatCurrencyInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const number = parseInt(numericValue, 10) / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCurrencyChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  const generateHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const parseCurrencyValue = (value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const findOrCreateIssuer = async (): Promise<string | null> => {
    if (!xmlData?.companyCnpj || !tenantId) return null;

    const cnpjClean = xmlData.companyCnpj.replace(/\D/g, '');
    
    // Check if issuer exists
    const { data: existing } = await supabase
      .from('issuers')
      .select('id')
      .eq('cnpj', cnpjClean)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Create new issuer
    const { data: newIssuer, error } = await supabase
      .from('issuers')
      .insert({
        tenant_id: tenantId,
        name: xmlData.companyName || 'Emitente',
        cnpj: cnpjClean,
        city: xmlData.companyCity || '',
        state: xmlData.companyState || '',
        iss_rate: xmlData.issPercentage || 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating issuer:', error);
      return null;
    }

    setAutoRegistered(prev => ({ ...prev, issuer: true }));
    return newIssuer.id;
  };

  const findOrCreateHospital = async (): Promise<string | null> => {
    if (!formData.hospitalName || !tenantId) return null;

    const cnpjClean = xmlData?.hospitalCnpj?.replace(/\D/g, '') || null;
    
    // First try to find by CNPJ if available
    if (cnpjClean) {
      const { data: byDoc } = await supabase
        .from('hospitals')
        .select('id')
        .eq('document', cnpjClean)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (byDoc) {
        return byDoc.id;
      }
    }

    // Then try by name
    const { data: byName } = await supabase
      .from('hospitals')
      .select('id')
      .eq('name', formData.hospitalName)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (byName) {
      return byName.id;
    }

    // Create new hospital
    const { data: newHospital, error } = await supabase
      .from('hospitals')
      .insert({
        tenant_id: tenantId,
        name: formData.hospitalName,
        document: cnpjClean,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating hospital:', error);
      return null;
    }

    setAutoRegistered(prev => ({ ...prev, hospital: true }));
    return newHospital.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Por favor, selecione um arquivo XML',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.expectedReceiptDate) {
      toast({
        title: 'Data obrigatória',
        description: 'Informe a data prevista de recebimento',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const hash = await generateHash(file);

      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('pdf_hash', hash)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Nota duplicada',
          description: 'Este arquivo XML já foi importado anteriormente',
          variant: 'destructive',
        });
        setIsUploading(false);
        return;
      }

      // Auto-register issuer and hospital
      const issuerId = await findOrCreateIssuer();
      const hospitalId = await findOrCreateHospital();

      // Upload file
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName);

      const grossValue = parseCurrencyValue(formData.grossValue);
      const totalDeductions = formData.hasRetention ? parseCurrencyValue(formData.totalDeductions) : 0;
      const issValue = parseCurrencyValue(formData.issValue);
      const issPercentage = parseCurrencyValue(formData.issPercentage);
      const irrfValue = parseCurrencyValue(formData.irrfValue);
      const inssValue = parseCurrencyValue(formData.inssValue);
      const csllValue = parseCurrencyValue(formData.csllValue);
      const pisValue = parseCurrencyValue(formData.pisValue);
      const cofinsValue = parseCurrencyValue(formData.cofinsValue);
      // Calcular valor líquido: usar XML se disponível, senão calcular
      // Se ISS retido, deve ser deduzido junto com as deduções federais
      const netValue = xmlData?.netValueFromXml && xmlData.netValueFromXml > 0
        ? xmlData.netValueFromXml
        : formData.hasRetention 
          ? (grossValue - totalDeductions - (formData.isIssRetained ? issValue : 0)) 
          : grossValue;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          pdf_url: urlData.publicUrl,
          pdf_hash: hash,
          invoice_type: formData.invoiceType || 'ABRASF',
          company_name: formData.companyName,
          issuer_id: issuerId,
          hospital_id: hospitalId,
          hospital_name: formData.hospitalName,
          issue_date: formData.issueDate,
          invoice_number: formData.invoiceNumber,
          gross_value: grossValue,
          total_deductions: totalDeductions,
          iss_value: issValue,
          iss_percentage: issPercentage,
          irrf_value: irrfValue,
          inss_value: inssValue,
          csll_value: csllValue,
          pis_value: pisValue,
          cofins_value: cofinsValue,
          net_value: netValue,
          is_iss_retained: formData.isIssRetained,
          expected_receipt_date: formData.expectedReceiptDate,
          created_by: user?.id,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Audit log for invoice import
      await logEvent({
        action: 'INSERT',
        tableName: 'invoices',
        recordId: invoice.id,
        recordLabel: `NF ${invoice.invoice_number} - ${invoice.company_name}`,
        newData: invoice,
      });

      // Show success message with auto-registration info
      const autoRegMessages: string[] = [];
      if (autoRegistered.issuer) autoRegMessages.push('emitente');
      if (autoRegistered.hospital) autoRegMessages.push('hospital');
      
      toast({
        title: 'Nota importada!',
        description: autoRegMessages.length > 0 
          ? `Cadastrado automaticamente: ${autoRegMessages.join(' e ')}. Agora você pode fazer o rateio.`
          : 'A nota foi importada com sucesso. Agora você pode fazer o rateio.',
      });

      navigate(ROUTES.allocationDetail(invoice.id));
    } catch (error: any) {
      console.error('Error importing invoice:', error);
      toast({
        title: 'Erro ao importar',
        description: error.message || 'Ocorreu um erro ao importar a nota',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Importar Nota Fiscal (XML)</h1>
        <p className="page-description">Upload do XML da NF-e - emitente e hospital serão cadastrados automaticamente via CNPJ</p>
      </div>

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList>
          <TabsTrigger value="single" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Importação Individual
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Files className="h-4 w-4" />
            Importação em Massa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Upload do Arquivo XML
              {isExtracting && (
                <span className="ml-2 flex items-center gap-1 text-sm font-normal text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lendo XML...
                </span>
              )}
              {extractionComplete && (
                <Badge variant="secondary" className="bg-success/20 text-success">
                  <FileCode className="mr-1 h-3 w-3" />
                  XML • Dados precisos
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Arraste um arquivo XML de Nota Fiscal Eletrônica (NF-e ou NFSe)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                ${file ? 'bg-success/5 border-success' : ''}
                ${isExtracting ? 'pointer-events-none opacity-70' : ''}
              `}
            >
              <input
                type="file"
                accept="text/xml,application/xml,.xml"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={isExtracting}
              />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Loader2 className="h-10 w-10 animate-spin" />
                  <span className="font-medium text-sm">Lendo dados do XML...</span>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-1 text-success">
                  <FileCode className="h-12 w-12" />
                  <span className="font-medium text-sm">{file.name}</span>
                  {extractionComplete && (
                    <span className="flex items-center gap-1 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Dados extraídos
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-10 w-10" />
                  <span className="font-medium text-sm">Arraste o XML aqui</span>
                  <Badge variant="outline" className="text-xs">XML</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Auto-registration info */}
        {extractionComplete && xmlData && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                Cadastro Automático
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Factory className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Emitente</p>
                  <p className="text-sm text-muted-foreground">{xmlData.companyName || '-'}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {xmlData.companyCnpj ? formatCNPJ(xmlData.companyCnpj) : 'CNPJ não encontrado'}
                  </p>
                  {xmlData.companyCity && xmlData.companyState && (
                    <p className="text-xs text-muted-foreground">{xmlData.companyCity}/{xmlData.companyState}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Hospital/Cliente</p>
                  <p className="text-sm text-muted-foreground">{xmlData.hospitalName || '-'}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {xmlData.hospitalCnpj ? formatCNPJ(xmlData.hospitalCnpj) : 'CNPJ não encontrado'}
                  </p>
                  {xmlData.hospitalCity && xmlData.hospitalState && (
                    <p className="text-xs text-muted-foreground">{xmlData.hospitalCity}/{xmlData.hospitalState}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Data Form */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Nota</CardTitle>
            <CardDescription>
              {extractionComplete 
                ? 'Verifique os dados extraídos e corrija se necessário' 
                : 'Preencha os dados da nota fiscal'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-6">
              {formData.invoiceType && (
                <div className="space-y-2">
                  <Label>Padrão da Nota</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                    <Badge variant={formData.invoiceType === 'NFS NACIONAL (SPED)' ? 'default' : 'secondary'}>
                      {formData.invoiceType}
                    </Badge>
                  </div>
                </div>
              )}
              {extractionComplete && (
                <div className="space-y-2">
                  <Label>Retenção</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                    <Badge variant={formData.isIssRetained ? 'default' : 'destructive'}>
                      {formData.isIssRetained ? 'Com Retenção' : 'Sem Retenção'}
                    </Badge>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="companyName">Empresa Emissora</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hospitalName">Hospital/Cliente</Label>
                <Input
                  id="hospitalName"
                  value={formData.hospitalName}
                  onChange={(e) => setFormData(prev => ({ ...prev, hospitalName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Número da Nota</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issueDate">Data de Emissão</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Financial Values */}
            <div className="mt-6 grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="grossValue">Valor Bruto</Label>
                <Input
                  id="grossValue"
                  value={formData.grossValue}
                  onChange={handleCurrencyChange('grossValue')}
                  className="input-currency"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issPercentage">% ISS</Label>
                <Input
                  id="issPercentage"
                  value={formData.issPercentage}
                  onChange={handleCurrencyChange('issPercentage')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issValue">ISS (R$)</Label>
                <Input
                  id="issValue"
                  value={formData.issValue}
                  onChange={handleCurrencyChange('issValue')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="irrfValue">IRRF</Label>
                <Input
                  id="irrfValue"
                  value={formData.irrfValue}
                  onChange={handleCurrencyChange('irrfValue')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inssValue">INSS/CP</Label>
                <Input
                  id="inssValue"
                  value={formData.inssValue}
                  onChange={handleCurrencyChange('inssValue')}
                  className="input-currency"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="csllValue">CSLL</Label>
                <Input
                  id="csllValue"
                  value={formData.csllValue}
                  onChange={handleCurrencyChange('csllValue')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pisValue">PIS</Label>
                <Input
                  id="pisValue"
                  value={formData.pisValue}
                  onChange={handleCurrencyChange('pisValue')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cofinsValue">COFINS</Label>
                <Input
                  id="cofinsValue"
                  value={formData.cofinsValue}
                  onChange={handleCurrencyChange('cofinsValue')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalDeductions">Total Retenções</Label>
                <Input
                  id="totalDeductions"
                  value={formData.totalDeductions}
                  onChange={handleCurrencyChange('totalDeductions')}
                  className="input-currency"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Líquido</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-mono text-sm">
                  {calculateNetValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="expectedReceiptDate">Data Prevista Recebimento</Label>
                <Input
                  id="expectedReceiptDate"
                  type="date"
                  value={formData.expectedReceiptDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedReceiptDate: e.target.value }))}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.allocation)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isUploading || isExtracting}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              'Importar e Ratear'
            )}
          </Button>
        </div>
          </form>
        </TabsContent>

        <TabsContent value="bulk">
          <BulkXMLImport />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
