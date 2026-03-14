import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";

const formSchema = z.object({
  juridico_empresa_id: z.string().min(1, "Selecione a empresa"),
  fornecedor_nome: z.string().min(1, "Informe o fornecedor"),
  data_contratacao: z.date({ required_error: "Informe a data de contratação" }),
  data_vencimento: z.date().optional().nullable(),
  status: z.string().default("ativo"),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ContratoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  contrato?: any;
}

export function ContratoFormDialog({ open, onOpenChange, onSuccess, contrato }: ContratoFormDialogProps) {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ["juridico_empresas_for_contratos", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("juridico_empresas" as any)
        .select("id, nome, cnpj")
        .eq("tenant_id", tenantId)
        .order("nome");
      return (data as unknown as { id: string; nome: string; cnpj: string | null }[]) || [];
    },
    enabled: !!tenantId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      juridico_empresa_id: "",
      fornecedor_nome: "",
      data_contratacao: new Date(),
      data_vencimento: null,
      status: "ativo",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (contrato) {
      form.reset({
        juridico_empresa_id: contrato.juridico_empresa_id || contrato.issuer_id || "",
        fornecedor_nome: contrato.fornecedor_nome,
        data_contratacao: new Date(contrato.data_contratacao + "T00:00:00"),
        data_vencimento: contrato.data_vencimento ? new Date(contrato.data_vencimento + "T00:00:00") : null,
        status: contrato.status,
        observacoes: contrato.observacoes || "",
      });
    } else {
      form.reset({
        juridico_empresa_id: "",
        fornecedor_nome: "",
        data_contratacao: new Date(),
        data_vencimento: null,
        status: "ativo",
        observacoes: "",
      });
    }
  }, [contrato, open]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        issuer_id: values.juridico_empresa_id, // keep old column in sync
        juridico_empresa_id: values.juridico_empresa_id,
        fornecedor_nome: values.fornecedor_nome,
        data_contratacao: format(values.data_contratacao, "yyyy-MM-dd"),
        data_vencimento: values.data_vencimento ? format(values.data_vencimento, "yyyy-MM-dd") : null,
        status: values.status,
        observacoes: values.observacoes || null,
        tenant_id: tenantId,
      };

      if (contrato) {
        const { error } = await supabase
          .from("contratos")
          .update(payload)
          .eq("id", contrato.id);
        if (error) throw error;
        toast({ title: "Contrato atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("contratos")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Contrato criado com sucesso" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar contrato", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="juridico_empresa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome} {e.cnpj ? `(${e.cnpj})` : ""}
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
              name="fornecedor_nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do fornecedor" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_contratacao"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Contratação</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_vencimento"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Vencimento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Sem vencimento"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="encerrado">Encerrado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Observações sobre o contrato" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {contrato ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
