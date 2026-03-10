import { AppLayout } from "@/components/layout/AppLayout";
import { FileSignature } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function JuridicoContratos() {
  useDocumentTitle("Controle de Contratos");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSignature className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Controle de Contratos
            </h1>
            <p className="text-muted-foreground">
              Gerencie os contratos do departamento jurídico.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <FileSignature className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Módulo em construção
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A funcionalidade de controle de contratos será implementada em breve.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
