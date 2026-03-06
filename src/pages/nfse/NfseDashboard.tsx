import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

export default function NfseDashboard() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">NFSE - Dashboard</h1>
        <p className="page-description">Visão geral do módulo de Nota Fiscal de Serviço Eletrônica</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Este módulo está sendo preparado e em breve estará disponível.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
