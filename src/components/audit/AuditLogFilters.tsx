import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { TABLE_LABELS, ACTION_LABELS, type AuditAction } from "@/hooks/useAuditLog";

export interface AuditLogFiltersState {
  startDate: Date | undefined;
  endDate: Date | undefined;
  action: AuditAction | "all";
  tableName: string;
  searchTerm: string;
}

interface AuditLogFiltersProps {
  filters: AuditLogFiltersState;
  onFiltersChange: (filters: AuditLogFiltersState) => void;
  users: { id: string; name: string }[];
  selectedUserId: string;
  onUserChange: (userId: string) => void;
}

const tableOptions = Object.entries(TABLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function AuditLogFilters({
  filters,
  onFiltersChange,
  users,
  selectedUserId,
  onUserChange,
}: AuditLogFiltersProps) {
  const updateFilter = <K extends keyof AuditLogFiltersState>(
    key: K,
    value: AuditLogFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      startDate: undefined,
      endDate: undefined,
      action: "all",
      tableName: "all",
      searchTerm: "",
    });
    onUserChange("all");
  };

  const hasActiveFilters =
    filters.startDate ||
    filters.endDate ||
    filters.action !== "all" ||
    filters.tableName !== "all" ||
    filters.searchTerm ||
    selectedUserId !== "all";

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex flex-wrap gap-3">
        {/* Date Range */}
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !filters.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate
                  ? format(filters.startDate, "dd/MM/yyyy")
                  : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate}
                onSelect={(date) => updateFilter("startDate", date)}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !filters.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate
                  ? format(filters.endDate, "dd/MM/yyyy")
                  : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate}
                onSelect={(date) => updateFilter("endDate", date)}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* User Filter */}
        <Select value={selectedUserId} onValueChange={onUserChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Filter */}
        <Select
          value={filters.action}
          onValueChange={(value) => updateFilter("action", value as AuditAction | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {(Object.entries(ACTION_LABELS) as [AuditAction, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* Table Filter */}
        <Select
          value={filters.tableName}
          onValueChange={(value) => updateFilter("tableName", value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os módulos</SelectItem>
            {tableOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por registro..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter("searchTerm", e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
