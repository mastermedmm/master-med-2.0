import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export default function NfseSincronizacao() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Sincronização</h1>
        <p className="page-description">Sincronização de notas fiscais com a prefeitura</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">A funcionalidade de sincronização estará disponível em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
