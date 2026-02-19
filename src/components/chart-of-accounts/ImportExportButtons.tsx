import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Upload, FileSpreadsheet, Loader2, ChevronDown } from "lucide-react";
import {
  exportChartOfAccountsToExcel,
  parseChartOfAccountsExcel,
  downloadChartOfAccountsTemplate,
  type ExportGroup,
  type ExportCategory,
  type ImportGroup,
  type ImportCategory,
} from "@/utils/chartOfAccountsExcel";

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  group_id: string | null;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ImportExportButtonsProps {
  groups: ExportGroup[];
  categories: ExpenseCategory[];
  onRefresh: () => void;
}

export function ImportExportButtons({
  groups,
  categories,
  onRefresh,
}: ImportExportButtonsProps) {
  const [importing, setImporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<{
    groups: ImportGroup[];
    categories: ImportCategory[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const normalizeKey = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  function handleExport() {
    try {
      // Add group_name to categories for export
      const categoriesWithGroupName: ExportCategory[] = categories.map((c) => ({
        ...c,
        group_name: groups.find((g) => g.id === c.group_id)?.name || null,
      }));

      exportChartOfAccountsToExcel(groups, categoriesWithGroupName);
      toast({ title: "Arquivo exportado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  function handleDownloadTemplate() {
    try {
      downloadChartOfAccountsTemplate();
      toast({ title: "Modelo baixado com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao baixar modelo",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseChartOfAccountsExcel(file);
      setImportData(data);
      setPreviewOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message,
        variant: "destructive",
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleImport() {
    if (!importData || !tenantId) return;

    setImporting(true);
    try {
      let groupsCreated = 0;
      let groupsUpdated = 0;
      let categoriesCreated = 0;
      let categoriesUpdated = 0;

      // Map to store created/existing group names to IDs
      const groupNameToId: Record<string, string> = {};

      // First, get existing groups
      const { data: existingGroups } = await supabase
        .from("expense_groups")
        .select("id, name")
        .eq("tenant_id", tenantId);

      existingGroups?.forEach((g) => {
        groupNameToId[normalizeKey(g.name)] = g.id;
      });

      // Import groups
      for (const group of importData.groups) {
        const existingId = groupNameToId[normalizeKey(group.nome)];

        if (existingId) {
          // Update existing
          await supabase
            .from("expense_groups")
            .update({
              name: group.nome,
              type: group.tipo,
              order_index: group.ordem,
              active: group.ativo,
            })
            .eq("id", existingId)
            .eq("tenant_id", tenantId);
          groupsUpdated++;
        } else {
          // Insert new
          const { data: newGroup } = await supabase
            .from("expense_groups")
            .insert({
              name: group.nome,
              type: group.tipo,
              order_index: group.ordem,
              active: group.ativo,
              tenant_id: tenantId,
            })
            .select("id")
            .single();

          if (newGroup) {
            groupNameToId[normalizeKey(group.nome)] = newGroup.id;
          }
          groupsCreated++;
        }
      }

      // Get existing categories
      const { data: existingCategories } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("tenant_id", tenantId);

      const categoryNameToId: Record<string, string> = {};
      existingCategories?.forEach((c) => {
        categoryNameToId[normalizeKey(c.name)] = c.id;
      });

      // Import categories
      let orderIndex = categories.length;
      for (const category of importData.categories) {
        const existingId = categoryNameToId[normalizeKey(category.nome)];
        const groupId = category.grupo
          ? groupNameToId[normalizeKey(category.grupo)] || null
          : null;

        if (existingId) {
          // Update existing
          await supabase
            .from("expense_categories")
            .update({
              name: category.nome,
              description: category.descricao || null,
              group_id: groupId,
              active: category.ativo,
            })
            .eq("id", existingId)
            .eq("tenant_id", tenantId);
          categoriesUpdated++;
        } else {
          // Insert new
          await supabase.from("expense_categories").insert({
            name: category.nome,
            description: category.descricao || null,
            group_id: groupId,
            order_index: orderIndex++,
            active: category.ativo,
            tenant_id: tenantId,
          });
          categoriesCreated++;
        }
      }

      setPreviewOpen(false);
      setImportData(null);
      onRefresh();

      toast({
        title: "Importação concluída!",
        description: `Grupos: ${groupsCreated} criados, ${groupsUpdated} atualizados. Contas: ${categoriesCreated} criadas, ${categoriesUpdated} atualizadas.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".xlsx,.xls"
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Plano de Contas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Baixar Modelo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar do Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Import Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>
              Revise os dados antes de importar. Grupos e contas com nomes
              iguais serão atualizados.
            </DialogDescription>
          </DialogHeader>

          {importData && (
            <div className="space-y-6">
              {/* Groups Preview */}
              <div>
                <h4 className="font-semibold mb-2">
                  Grupos ({importData.groups.length})
                </h4>
                {importData.groups.length > 0 ? (
                  <div className="border rounded-md max-h-40 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Nome</th>
                          <th className="text-left p-2">Tipo</th>
                          <th className="text-center p-2">Ativo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.groups.map((g, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{g.nome}</td>
                            <td className="p-2 capitalize">{g.tipo}</td>
                            <td className="p-2 text-center">
                              {g.ativo ? "✓" : "✗"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nenhum grupo encontrado
                  </p>
                )}
              </div>

              {/* Categories Preview */}
              <div>
                <h4 className="font-semibold mb-2">
                  Contas ({importData.categories.length})
                </h4>
                {importData.categories.length > 0 ? (
                  <div className="border rounded-md max-h-40 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Nome</th>
                          <th className="text-left p-2">Grupo</th>
                          <th className="text-center p-2">Ativo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.categories.map((c, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{c.nome}</td>
                            <td className="p-2 text-muted-foreground">
                              {c.grupo || "—"}
                            </td>
                            <td className="p-2 text-center">
                              {c.ativo ? "✓" : "✗"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nenhuma conta encontrada
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
