import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, History, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/useTablePagination";
import {
  AuditLogFilters,
  type AuditLogFiltersState,
} from "@/components/audit/AuditLogFilters";
import { AuditLogDetails } from "@/components/audit/AuditLogDetails";
import {
  TABLE_LABELS,
  ACTION_LABELS,
  ACTION_COLORS,
  type AuditAction,
} from "@/hooks/useAuditLog";
import * as XLSX from "@e965/xlsx";
import { Json } from "@/integrations/supabase/types";

interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  user_name: string;
  action: string;
  table_name: string;
  record_id: string;
  record_label: string | null;
  old_data: Json;
  new_data: Json;
  changed_fields: string[] | null;
  created_at: string;
  ip_address: string | null;
}

export default function AuditLogs() {
  useDocumentTitle("Log de Eventos");
  const { tenantId } = useTenant();

  const [filters, setFilters] = useState<AuditLogFiltersState>({
    startDate: undefined,
    endDate: undefined,
    action: "all",
    tableName: "all",
    searchTerm: "",
  });
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch audit logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", tenantId, filters, selectedUserId],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (filters.startDate) {
        query = query.gte(
          "created_at",
          format(filters.startDate, "yyyy-MM-dd")
        );
      }
      if (filters.endDate) {
        query = query.lte(
          "created_at",
          format(filters.endDate, "yyyy-MM-dd") + "T23:59:59"
        );
      }
      if (filters.action !== "all") {
        query = query.eq("action", filters.action);
      }
      if (filters.tableName !== "all") {
        query = query.eq("table_name", filters.tableName);
      }
      if (selectedUserId !== "all") {
        query = query.eq("user_id", selectedUserId);
      }
      if (filters.searchTerm) {
        query = query.ilike("record_label", `%${filters.searchTerm}%`);
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!tenantId,
  });

  // Get unique users from logs for filter
  const uniqueUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    logs.forEach((log) => {
      if (log.user_id && !userMap.has(log.user_id)) {
        userMap.set(log.user_id, log.user_name);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Pagination
  const pagination = useTablePagination(logs, { pageSize: 50 });

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleExportExcel = () => {
    const exportData = logs.map((log) => ({
      "Data/Hora": format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
        locale: ptBR,
      }),
      Usuário: log.user_name,
      Ação: ACTION_LABELS[log.action as AuditAction] || log.action,
      Módulo: TABLE_LABELS[log.table_name] || log.table_name,
      Registro: log.record_label || log.record_id,
      "Campos Alterados": log.changed_fields?.join(", ") || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log de Eventos");
    XLSX.writeFile(
      wb,
      `log-eventos-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Log de Eventos</h1>
              <p className="text-muted-foreground">
                Histórico de todas as alterações realizadas no sistema
              </p>
            </div>
          </div>
          <Button onClick={handleExportExcel} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        <AuditLogFilters
          filters={filters}
          onFiltersChange={setFilters}
          users={uniqueUsers}
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="w-[100px] text-center">
                  Detalhes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginatedData.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>{log.user_name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ACTION_COLORS[log.action as AuditAction] || ""
                        }
                      >
                        {ACTION_LABELS[log.action as AuditAction] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {TABLE_LABELS[log.table_name] || log.table_name}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.record_label || log.record_id}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          onPageChange={pagination.goToPage}
          onNextPage={pagination.nextPage}
          onPrevPage={pagination.prevPage}
          onFirstPage={pagination.firstPage}
          onLastPage={pagination.lastPage}
        />

        <AuditLogDetails
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          log={
            selectedLog
              ? {
                  action: selectedLog.action,
                  table_name: selectedLog.table_name,
                  record_label: selectedLog.record_label,
                  old_data: selectedLog.old_data as Record<string, unknown> | null,
                  new_data: selectedLog.new_data as Record<string, unknown> | null,
                  changed_fields: selectedLog.changed_fields,
                  user_name: selectedLog.user_name,
                  created_at: selectedLog.created_at,
                }
              : null
          }
        />
      </div>
    </AppLayout>
  );
}
