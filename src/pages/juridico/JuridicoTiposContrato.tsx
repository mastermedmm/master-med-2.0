import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

interface TipoContrato {
  id: string;
  nome: string;
  active: boolean;
}

export default function JuridicoTiposContrato() {
  useDocumentTitle("Tipos de Contrato");
  const { tenantId } = useTenant();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoContrato | null>(null);
  const [nome, setNome] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["juridico_tipos_contrato", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("juridico_tipos_contrato" as any)
        .select("id, nome, active")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (error) throw error;
      return (data as unknown as TipoContrato[]) || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTipo) {
        const { error } = await supabase
          .from("juridico_tipos_contrato" as any)
          .update({ nome } as any)
          .eq("id", editingTipo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("juridico_tipos_contrato" as any)
          .insert({ nome, tenant_id: tenantId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTipo ? "Tipo atualizado" : "Tipo criado");
      queryClient.invalidateQueries({ queryKey: ["juridico_tipos_contrato"] });
      setFormOpen(false);
      setNome("");
      setEditingTipo(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("juridico_tipos_contrato" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo removido");
      queryClient.invalidateQueries({ queryKey: ["juridico_tipos_contrato"] });
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleNew = () => {
    setEditingTipo(null);
    setNome("");
    setFormOpen(true);
  };

  const handleEdit = (tipo: TipoContrato) => {
    setEditingTipo(tipo);
    setNome(tipo.nome);
    setFormOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tags className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Tipos de Contrato</h1>
              <p className="text-muted-foreground">Gerencie os tipos de contrato disponíveis.</p>
            </div>
          </div>
          {canCreate("juridico.contratos") && (
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Tipo
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : tipos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                    Nenhum tipo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                tipos.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canUpdate("juridico.contratos") && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete("juridico.contratos") && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTipo ? "Editar Tipo" : "Novo Tipo de Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Marketing, Software..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!nome.trim() || saveMutation.isPending}>
              {editingTipo ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tipo de contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Contratos vinculados a este tipo ficarão sem tipo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
