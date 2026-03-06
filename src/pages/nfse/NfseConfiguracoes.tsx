import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog } from 'lucide-react';

export default function NfseConfiguracoes() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">Configurações NFSE</h1>
        <p className="page-description">Configurações do módulo de emissão de NFSE</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">As configurações de NFSE estarão disponíveis em breve.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
