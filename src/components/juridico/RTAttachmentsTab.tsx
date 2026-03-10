import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Upload, FileText, Download, Trash2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
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

interface Anexo {
  id: string;
  vinculo_rt_id: string;
  nome_arquivo: string;
  tipo_arquivo: string | null;
  caminho_arquivo: string;
  tamanho_bytes: number | null;
  usuario_nome: string | null;
  created_at: string;
}

interface Props {
  vinculoId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RTAttachmentsTab({ vinculoId }: Props) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['user-profile-for-rt-attach', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch attachments
  const { data: anexos, isLoading } = useQuery({
    queryKey: ["anexos_vinculos_rt", vinculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos_vinculos_rt" as any)
        .select("*")
        .eq("vinculo_rt_id", vinculoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Anexo[];
    },
    enabled: !!vinculoId,
  });

  // Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user || !tenantId) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${tenantId}/${vinculoId}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("rt-anexos")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("anexos_vinculos_rt" as any)
          .insert({
            vinculo_rt_id: vinculoId,
            nome_arquivo: file.name,
            tipo_arquivo: file.type || null,
            caminho_arquivo: filePath,
            tamanho_bytes: file.size,
            usuario_id: user.id,
            usuario_nome: profile?.full_name || user.email || "Desconhecido",
            tenant_id: tenantId,
          } as any);
        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ["anexos_vinculos_rt", vinculoId] });
      toast.success(`${files.length} arquivo(s) enviado(s) com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Download
  const handleDownload = async (anexo: Anexo) => {
    try {
      const { data, error } = await supabase.storage
        .from("rt-anexos")
        .download(anexo.caminho_arquivo);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = anexo.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Erro ao baixar arquivo: " + err.message);
    }
  };

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (anexo: Anexo) => {
      const { error: storageError } = await supabase.storage
        .from("rt-anexos")
        .remove([anexo.caminho_arquivo]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("anexos_vinculos_rt" as any)
        .delete()
        .eq("id", anexo.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anexos_vinculos_rt", vinculoId] });
      toast.success("Arquivo excluído com sucesso!");
      setDeletingId(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
      setDeletingId(null);
    },
  });

  const anexoToDelete = anexos?.find((a) => a.id === deletingId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      {/* Upload button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Documentos anexados
        </h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`mr-2 h-4 w-4 ${uploading ? "animate-spin" : ""}`} />
            {uploading ? "Enviando..." : "Enviar arquivo"}
          </Button>
        </div>
      </div>

      {/* List */}
      {!anexos?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Paperclip className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">Nenhum anexo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em "Enviar arquivo" para adicionar documentos.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {anexos.map((anexo) => (
            <div key={anexo.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{anexo.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(anexo.tamanho_bytes)} • {format(new Date(anexo.created_at), "dd/MM/yyyy HH:mm")}
                    {anexo.usuario_nome && ` • ${anexo.usuario_nome}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" title="Baixar" onClick={() => handleDownload(anexo)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeletingId(anexo.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir o arquivo "{anexoToDelete?.nome_arquivo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => anexoToDelete && deleteMutation.mutate(anexoToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
