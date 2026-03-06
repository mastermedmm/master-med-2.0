import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

export default function NfseNotasEmitidas() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Notas Emitidas</h1>
        <p className="page-description">Consulta de notas fiscais de serviço emitidas</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">A listagem de notas emitidas estará disponível em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
