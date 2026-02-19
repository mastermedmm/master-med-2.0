import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Pencil, Trash2, Tags } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExpenseGroup } from "./GroupsTab";

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

interface FormData {
  name: string;
  description: string;
  group_id: string;
  order_index: number;
  active: boolean;
}

interface AccountsTabProps {
  categories: ExpenseCategory[];
  groups: ExpenseGroup[];
  loading: boolean;
  onRefresh: () => void;
}

export function AccountsTab({ categories, groups, loading, onRefresh }: AccountsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      group_id: "",
      order_index: 0,
      active: true,
    },
  });

  function handleNew() {
    setSelectedCategory(null);
    form.reset({ 
      name: "", 
      description: "", 
      group_id: "__none__",
      order_index: categories.length, 
      active: true 
    });
    setDialogOpen(true);
  }

  function handleEdit(category: ExpenseCategory) {
    setSelectedCategory(category);
    form.reset({
      name: category.name,
      description: category.description || "",
      group_id: category.group_id || "__none__",
      order_index: category.order_index,
      active: category.active,
    });
    setDialogOpen(true);
  }

  function handleDeleteClick(category: ExpenseCategory) {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      if (selectedCategory) {
        const { error } = await supabase
          .from("expense_categories")
          .update({
            name: data.name,
            description: data.description || null,
            group_id: data.group_id === "__none__" ? null : data.group_id,
            order_index: data.order_index,
            active: data.active,
          })
          .eq("id", selectedCategory.id);

        if (error) throw error;
        toast({ title: "Conta atualizada com sucesso!" });
      } else {
        const { error } = await supabase.from("expense_categories").insert({
          name: data.name,
          description: data.description || null,
          group_id: data.group_id === "__none__" ? null : data.group_id,
          order_index: data.order_index,
          active: data.active,
          tenant_id: tenantId,
        });

        if (error) throw error;
        toast({ title: "Conta criada com sucesso!" });
      }

      setDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar conta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from("expense_categories")
        .delete()
        .eq("id", selectedCategory.id);

      if (error) throw error;
      toast({ title: "Conta excluída com sucesso!" });
      setDeleteDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir conta",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "Sem grupo";
    return groups.find(g => g.id === groupId)?.name || "Grupo não encontrado";
  };

  // Organize categories by group for display
  const categoriesByGroup = categories.reduce((acc, cat) => {
    const groupId = cat.group_id || "ungrouped";
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(cat);
    return acc;
  }, {} as Record<string, ExpenseCategory[]>);

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
            Nova Conta
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Tags className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhuma conta cadastrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie contas para classificar suas despesas.
          </p>
          {canCreate("expenses") && (
            <Button className="mt-4" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Conta
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getGroupName(category.group_id)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.description || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={category.active ? "default" : "secondary"}>
                      {category.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate("expenses") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete("expenses") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(category)}
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
              {selectedCategory ? "Editar Conta" : "Nova Conta"}
            </DialogTitle>
            <DialogDescription>
              {selectedCategory
                ? "Atualize os dados da conta."
                : "Preencha os dados para criar uma nova conta."}
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
                      <Input placeholder="Ex: Folha de Pagamento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="group_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sem grupo</SelectItem>
                        {groups.filter(g => g.active).map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva a conta..."
                        className="resize-none"
                        {...field}
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
                      <FormLabel>Conta Ativa</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Contas inativas não aparecem na seleção de despesas.
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
                  {selectedCategory ? "Salvar" : "Criar"}
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
            <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta "{selectedCategory?.name}"?
              Esta ação não pode ser desfeita.
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
