import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FIELD_LABELS, ACTION_LABELS, ACTION_COLORS, type AuditAction } from "@/hooks/useAuditLog";

interface AuditLogDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: {
    action: string;
    table_name: string;
    record_label: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_fields: string[] | null;
    user_name: string;
    created_at: string;
  } | null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (value >= 0.01 && Number.isFinite(value)) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

export function AuditLogDetails({ open, onOpenChange, log }: AuditLogDetailsProps) {
  if (!log) return null;

  const action = log.action as AuditAction;
  const isInsert = action === 'INSERT';
  const isDelete = action === 'DELETE';
  const isUpdate = action === 'UPDATE';

  // Get all fields to display
  const getFieldsToDisplay = () => {
    if (isInsert && log.new_data) {
      return Object.keys(log.new_data).filter(
        key => !['created_at', 'updated_at', 'tenant_id', 'id'].includes(key)
      );
    }
    if (isDelete && log.old_data) {
      return Object.keys(log.old_data).filter(
        key => !['created_at', 'updated_at', 'tenant_id', 'id'].includes(key)
      );
    }
    if (isUpdate && log.changed_fields) {
      return log.changed_fields;
    }
    return [];
  };

  const fields = getFieldsToDisplay();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Alteração
            <Badge className={ACTION_COLORS[action]}>
              {ACTION_LABELS[action]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Registro:</span>
              <p className="font-medium">{log.record_label || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Usuário:</span>
              <p className="font-medium">{log.user_name}</p>
            </div>
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum detalhe disponível
              </p>
            ) : (
              <div className="space-y-3">
                {isUpdate && (
                  <div className="grid grid-cols-3 gap-2 pb-2 border-b font-medium text-sm">
                    <span>Campo</span>
                    <span>Valor Anterior</span>
                    <span>Valor Novo</span>
                  </div>
                )}
                
                {isInsert && (
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b font-medium text-sm">
                    <span>Campo</span>
                    <span>Valor</span>
                  </div>
                )}
                
                {isDelete && (
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b font-medium text-sm">
                    <span>Campo</span>
                    <span>Valor Excluído</span>
                  </div>
                )}

                {fields.map((field) => (
                  <div 
                    key={field} 
                    className={`grid ${isUpdate ? 'grid-cols-3' : 'grid-cols-2'} gap-2 py-2 text-sm ${
                      isUpdate ? 'bg-yellow-50 dark:bg-yellow-900/20 -mx-2 px-2 rounded' : ''
                    }`}
                  >
                    <span className="font-medium">{getFieldLabel(field)}</span>
                    
                    {isUpdate && (
                      <>
                        <span className="text-red-600 dark:text-red-400">
                          {formatValue(log.old_data?.[field])}
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          {formatValue(log.new_data?.[field])}
                        </span>
                      </>
                    )}
                    
                    {isInsert && (
                      <span className="text-green-600 dark:text-green-400">
                        {formatValue(log.new_data?.[field])}
                      </span>
                    )}
                    
                    {isDelete && (
                      <span className="text-red-600 dark:text-red-400">
                        {formatValue(log.old_data?.[field])}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
