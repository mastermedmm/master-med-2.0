import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderDown } from 'lucide-react';

export default function NfseDocumentos() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Documentos XML/PDF</h1>
        <p className="page-description">Download e consulta de documentos XML e PDF das notas fiscais</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderDown className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">O repositório de documentos estará disponível em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
