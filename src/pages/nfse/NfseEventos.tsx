import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export default function NfseEventos() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Eventos da Nota</h1>
        <p className="page-description">Histórico de eventos das notas fiscais</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">O painel de eventos estará disponível em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
