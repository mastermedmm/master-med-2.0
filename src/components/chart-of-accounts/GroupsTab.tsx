import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export interface ExpenseGroup {
  id: string;
  name: string;
  type: string;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  type: string;
  order_index: number;
  active: boolean;
}

interface GroupsTabProps {
  groups: ExpenseGroup[];
  loading: boolean;
  onRefresh: () => void;
}

const GROUP_TYPES = [
  { value: "expense", label: "Despesa" },
  { value: "deduction", label: "Dedução" },
  { value: "distribution", label: "Distribuição" },
];

export function GroupsTab({ groups, loading, onRefresh }: GroupsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ExpenseGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      type: "expense",
      order_index: 0,
      active: true,
    },
  });

  function handleNew() {
    setSelectedGroup(null);
    form.reset({ name: "", type: "expense", order_index: groups.length, active: true });
    setDialogOpen(true);
  }

  function handleEdit(group: ExpenseGroup) {
    setSelectedGroup(group);
    form.reset({
      name: group.name,
      type: group.type,
      order_index: group.order_index,
      active: group.active,
    });
    setDialogOpen(true);
  }

  function handleDeleteClick(group: ExpenseGroup) {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      if (selectedGroup) {
        const { error } = await supabase
          .from("expense_groups")
          .update({
            name: data.name,
            type: data.type,
            order_index: data.order_index,
            active: data.active,
          })
          .eq("id", selectedGroup.id);

        if (error) throw error;
        toast({ title: "Grupo atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("expense_groups").insert({
          name: data.name,
          type: data.type,
          order_index: data.order_index,
          active: data.active,
          tenant_id: tenantId,
        });

        if (error) throw error;
        toast({ title: "Grupo criado com sucesso!" });
      }

      setDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar grupo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedGroup) return;

    try {
      const { error } = await supabase
        .from("expense_groups")
        .delete()
        .eq("id", selectedGroup.id);

      if (error) throw error;
      toast({ title: "Grupo excluído com sucesso!" });
      setDeleteDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir grupo",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  const getTypeLabel = (type: string) => {
    return GROUP_TYPES.find(t => t.value === type)?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate("expenses") && (
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Grupo
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderTree className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum grupo cadastrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie grupos para organizar suas categorias de despesas.
          </p>
          {canCreate("expenses") && (
            <Button className="mt-4" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Grupo
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="text-muted-foreground">{group.order_index}</TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(group.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={group.active ? "default" : "secondary"}>
                      {group.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate("expenses") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(group)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete("expenses") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(group)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedGroup ? "Editar Grupo" : "Novo Grupo"}
            </DialogTitle>
            <DialogDescription>
              {selectedGroup
                ? "Atualize os dados do grupo."
                : "Preencha os dados para criar um novo grupo."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "Nome é obrigatório" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Custo Fixo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GROUP_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order_index"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Grupo Ativo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Grupos inativos não aparecem no relatório.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedGroup ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o grupo "{selectedGroup?.name}"?
              As categorias vinculadas ficarão sem grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
