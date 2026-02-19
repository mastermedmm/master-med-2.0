import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ExternalLink, Building2, FileText, Calendar, DollarSign, Percent, AlertTriangle, Check } from 'lucide-react';
import { formatDateBR } from '@/lib/utils';

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_type: string;
  company_name: string;
  hospital_name: string;
  issue_date: string;
  expected_receipt_date: string;
  gross_value: number;
  total_deductions: number;
  net_value: number;
  iss_value: number;
  iss_percentage: number;
  irrf_value: number;
  inss_value: number;
  csll_value: number;
  pis_value: number;
  cofins_value: number;
  is_iss_retained?: boolean;
  pdf_url: string | null;
  issuers?: { cnpj: string } | null;
  hospitals?: { document: string } | null;
}

interface InvoiceViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceData | null;
}

export function InvoiceViewer({ open, onOpenChange, invoice }: InvoiceViewerProps) {
  if (!invoice) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Use imported formatDateBR from utils

  const formatCNPJ = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const handleOpenXml = () => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Lógica para exibição do ISS
  // IMPORTANT: não inferir por cálculo (regrediu casos ABRASF). Usar o campo do banco.
  // Se vier nulo/undefined, consideramos como "não retido" apenas para fins de exibição.
  const isIssRetained = invoice.is_iss_retained === true;
  const showIssInRetained = isIssRetained && invoice.iss_value > 0;
  const showIssAsInfo = !isIssRetained && invoice.iss_value > 0;

  // Verifica se há impostos retidos (federais + ISS se retido)
  const hasRetainedTaxes = 
    showIssInRetained ||
    invoice.irrf_value > 0 || 
    invoice.inss_value > 0 || 
    invoice.csll_value > 0 || 
    invoice.pis_value > 0 || 
    invoice.cofins_value > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Nota Fiscal {invoice.invoice_number}
            </DialogTitle>
            <Badge variant="outline">{invoice.invoice_type}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Emitente */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Emitente
            </h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium">{invoice.company_name}</p>
              {invoice.issuers?.cnpj && (
                <p className="text-sm text-muted-foreground">
                  CNPJ: {formatCNPJ(invoice.issuers.cnpj)}
                </p>
              )}
            </div>
          </div>

          {/* Tomador */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Tomador (Hospital/Clínica)
            </h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium">{invoice.hospital_name}</p>
              {invoice.hospitals?.document && (
                <p className="text-sm text-muted-foreground">
                  CNPJ: {formatCNPJ(invoice.hospitals.document)}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data de Emissão
              </p>
              <p className="font-medium">{formatDateBR(invoice.issue_date)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Previsão de Recebimento
              </p>
              <p className="font-medium">{formatDateBR(invoice.expected_receipt_date)}</p>
            </div>
          </div>

          <Separator />

          {/* Valores */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valores
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span>Valor Bruto</span>
                <span className="font-semibold text-lg">{formatCurrency(invoice.gross_value)}</span>
              </div>
              
              {invoice.total_deductions > 0 && (
                <div className="flex justify-between items-center text-destructive">
                  <span>(-) Deduções Totais</span>
                  <span>{formatCurrency(invoice.total_deductions)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-semibold">Valor Líquido</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(invoice.net_value)}</span>
              </div>
            </div>
          </div>

          {/* Impostos Retidos (federais + ISS se retido) */}
          {hasRetainedTaxes && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Impostos Retidos
              </h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {showIssInRetained && (
                    <div className="flex justify-between">
                      <span>ISS ({invoice.iss_percentage}%)</span>
                      <span>{formatCurrency(invoice.iss_value)}</span>
                    </div>
                  )}
                  {invoice.irrf_value > 0 && (
                    <div className="flex justify-between">
                      <span>IRRF</span>
                      <span>{formatCurrency(invoice.irrf_value)}</span>
                    </div>
                  )}
                  {invoice.inss_value > 0 && (
                    <div className="flex justify-between">
                      <span>INSS</span>
                      <span>{formatCurrency(invoice.inss_value)}</span>
                    </div>
                  )}
                  {invoice.csll_value > 0 && (
                    <div className="flex justify-between">
                      <span>CSLL</span>
                      <span>{formatCurrency(invoice.csll_value)}</span>
                    </div>
                  )}
                  {invoice.pis_value > 0 && (
                    <div className="flex justify-between">
                      <span>PIS</span>
                      <span>{formatCurrency(invoice.pis_value)}</span>
                    </div>
                  )}
                  {invoice.cofins_value > 0 && (
                    <div className="flex justify-between">
                      <span>COFINS</span>
                      <span>{formatCurrency(invoice.cofins_value)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ISS Sem Retenção (informativo) */}
          {showIssAsInfo && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-warning flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                ISS Sem Retenção{invoice.iss_percentage > 0 ? ` (${invoice.iss_percentage}%)` : ''}
              </h3>
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div className="flex justify-between items-center text-sm">
                  <span>Valor calculado</span>
                  <span className="font-medium">{formatCurrency(invoice.iss_value)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Este imposto não foi deduzido do valor líquido da nota
                </p>
              </div>
            </div>
          )}

          {/* Status do ISS - indicador visual */}
          {invoice.iss_value > 0 && (
            <div className="flex items-center gap-2">
              {isIssRetained ? (
                <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
                  <Check className="h-3 w-3 mr-1" />
                  ISS Retido na Fonte
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  ISS Devido pelo Prestador
                </Badge>
              )}
            </div>
          )}

          {/* Botão para abrir XML original */}
          {invoice.pdf_url && (
            <Button variant="outline" onClick={handleOpenXml} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver XML Original
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
