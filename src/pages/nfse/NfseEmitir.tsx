import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilePlus } from 'lucide-react';

export default function NfseEmitir() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Emitir Nota</h1>
        <p className="page-description">Emissão de Nota Fiscal de Serviço Eletrônica</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">A funcionalidade de emissão de NFSE estará disponível em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
