import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function NfseRejeicoes() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Rejeições</h1>
        <p className="page-description">Notas fiscais rejeitadas pela prefeitura</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">O painel de rejeições estará disponível em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
