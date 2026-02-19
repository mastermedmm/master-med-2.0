import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Download, Upload, FileSpreadsheet, Loader2, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ParsedDoctor,
  ExportDoctor,
  parseDoctorsExcel,
  exportDoctorsToExcel,
  downloadDoctorsTemplate,
} from '@/utils/doctorsExcel';

interface DoctorImportExportProps {
  doctors: ExportDoctor[];
  onRefresh: () => void;
}

interface ImportResult {
  doctor: ParsedDoctor;
  status: 'new' | 'update' | 'error';
  message?: string;
}

export function DoctorImportExport({ doctors, onRefresh }: DoctorImportExportProps) {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<ParsedDoctor[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  
  const handleExport = () => {
    if (doctors.length === 0) {
      toast({
        title: 'Nenhum médico',
        description: 'Não há médicos para exportar',
        variant: 'destructive',
      });
      return;
    }
    
    exportDoctorsToExcel(doctors);
    toast({ title: 'Exportação concluída!' });
  };
  
  const handleDownloadTemplate = () => {
    downloadDoctorsTemplate();
    toast({ title: 'Template baixado!' });
  };
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const parsed = await parseDoctorsExcel(file);
      setImportData(parsed);
      setImportResults([]);
      setImportComplete(false);
      setPreviewOpen(true);
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Erro ao ler arquivo',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleImport = async () => {
    if (!tenantId) {
      toast({
        title: 'Erro',
        description: 'Tenant não identificado',
        variant: 'destructive',
      });
      return;
    }
    
    setIsImporting(true);
    const results: ImportResult[] = [];
    
    try {
      for (const doctor of importData) {
        try {
          // Check if doctor exists by CPF
          const { data: existing, error: lookupError } = await supabase
            .from('doctors')
            .select('id, aliquota, portal_password_hash, must_change_password')
            .eq('cpf', doctor.cpf)
            .maybeSingle();
          
          if (lookupError) throw lookupError;
          
          if (existing) {
            // Update existing doctor, preserving aliquota and portal settings
            const { error: updateError } = await supabase
              .from('doctors')
              .update({
                name: doctor.name,
                crm: doctor.crm,
                phone: doctor.phone,
                bank_name: doctor.bank_name,
                pix_key: doctor.pix_key,
                bank_agency: doctor.bank_agency,
                bank_account: doctor.bank_account,
                is_freelancer: doctor.is_freelancer,
                birth_date: doctor.birth_date,
                address: doctor.address,
                neighborhood: doctor.neighborhood,
                zip_code: doctor.zip_code,
                city: doctor.city,
                state: doctor.state,
                certificate_expires_at: doctor.certificate_expires_at,
                linked_company: doctor.linked_company,
                linked_company_2: doctor.linked_company_2,
              })
              .eq('id', existing.id);
            
            if (updateError) throw updateError;
            
            results.push({
              doctor,
              status: 'update',
              message: 'Dados atualizados (alíquota e portal preservados)',
            });
          } else {
            // Insert new doctor with default aliquota
            const { data: newDoctor, error: insertError } = await supabase
              .from('doctors')
              .insert({
                tenant_id: tenantId,
                name: doctor.name,
                cpf: doctor.cpf,
                crm: doctor.crm,
                aliquota: 15, // Default aliquota
                phone: doctor.phone,
                bank_name: doctor.bank_name,
                pix_key: doctor.pix_key,
                bank_agency: doctor.bank_agency,
                bank_account: doctor.bank_account,
                is_freelancer: doctor.is_freelancer,
                birth_date: doctor.birth_date,
                address: doctor.address,
                neighborhood: doctor.neighborhood,
                zip_code: doctor.zip_code,
                city: doctor.city,
                state: doctor.state,
                certificate_expires_at: doctor.certificate_expires_at,
                linked_company: doctor.linked_company,
                linked_company_2: doctor.linked_company_2,
              })
              .select('id')
              .single();
            
            if (insertError) throw insertError;
            
            // Auto-provision portal access
            const defaultPassword = doctor.crm.replace(/\D/g, '');
            await supabase.functions.invoke('doctor-auth/set-password', {
              body: {
                doctorId: newDoctor.id,
                password: defaultPassword,
                resetRequired: true,
              },
            });
            
            results.push({
              doctor,
              status: 'new',
              message: `Criado com alíquota 15%. Portal: ${doctor.crm} / ${defaultPassword}`,
            });
          }
        } catch (error: any) {
          console.error('Error importing doctor:', doctor.name, error);
          results.push({
            doctor,
            status: 'error',
            message: error.message,
          });
        }
      }
      
      setImportResults(results);
      setImportComplete(true);
      
      const newCount = results.filter(r => r.status === 'new').length;
      const updateCount = results.filter(r => r.status === 'update').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      toast({
        title: 'Importação concluída!',
        description: `${newCount} novos, ${updateCount} atualizados, ${errorCount} erros`,
      });
      
      onRefresh();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };
  
  const handleClose = () => {
    setPreviewOpen(false);
    setImportData([]);
    setImportResults([]);
    setImportComplete(false);
  };
  
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Médicos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Baixar Modelo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Import Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {importComplete ? 'Resultado da Importação' : 'Prévia da Importação'}
            </DialogTitle>
            <DialogDescription>
              {importComplete 
                ? 'Confira o resultado da importação abaixo'
                : `${importData.length} médico(s) encontrado(s) na planilha`
              }
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  {importComplete && <TableHead>Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(importComplete ? importResults : importData.map(d => ({ doctor: d, status: 'new' as const }))).map((item, index) => {
                  const doctor = 'doctor' in item ? item.doctor : item;
                  const result = 'status' in item && importComplete ? item : null;
                  
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{doctor.name}</TableCell>
                      <TableCell className="font-mono text-sm">{doctor.cpf}</TableCell>
                      <TableCell>{doctor.crm}</TableCell>
                      <TableCell>{doctor.phone || '-'}</TableCell>
                      <TableCell>
                        {doctor.city && doctor.state 
                          ? `${doctor.city}/${doctor.state}`
                          : doctor.city || doctor.state || '-'
                        }
                      </TableCell>
                      {importComplete && result && (
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge 
                              variant={
                                result.status === 'new' ? 'default' :
                                result.status === 'update' ? 'secondary' : 'destructive'
                              }
                              className="w-fit"
                            >
                              {result.status === 'new' && <Check className="mr-1 h-3 w-3" />}
                              {result.status === 'update' && <Check className="mr-1 h-3 w-3" />}
                              {result.status === 'error' && <AlertCircle className="mr-1 h-3 w-3" />}
                              {result.status === 'new' ? 'Novo' : 
                               result.status === 'update' ? 'Atualizado' : 'Erro'}
                            </Badge>
                            {result.message && (
                              <span className="text-xs text-muted-foreground">
                                {result.message}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {importComplete ? 'Fechar' : 'Cancelar'}
            </Button>
            {!importComplete && (
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar {importData.length} médico(s)
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
