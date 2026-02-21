import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { Loader2, Save, Link, Settings as SettingsIcon, Upload, Trash2, ImageIcon } from 'lucide-react';
interface SystemSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
}

export default function Settings() {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctorPortalLink, setDoctorPortalLink] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [removingBanner, setRemovingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenantId) {
      loadSettings();
    }
  }, [tenantId]);

  const loadSettings = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('key', ['doctor_portal_link', 'doctor_portal_banner']);

      if (error) throw error;
      
      if (data) {
        const linkSetting = data.find(s => s.key === 'doctor_portal_link');
        const bannerSetting = data.find(s => s.key === 'doctor_portal_banner');
        setDoctorPortalLink(linkSetting?.value || '');
        setBannerUrl(bannerSetting?.value || null);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem (JPG, PNG, WebP)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingBanner(true);
    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      const newBannerUrl = urlData.publicUrl;

      // Upsert system_settings with tenant_id
      const { error: updateError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'doctor_portal_banner',
          value: newBannerUrl,
          tenant_id: tenantId,
          description: 'URL da imagem do banner do Portal do Médico'
        }, { onConflict: 'tenant_id,key' });

      if (updateError) throw updateError;

      // Delete old banner if exists
      if (bannerUrl) {
        const oldFileName = bannerUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('banners').remove([oldFileName]);
        }
      }

      setBannerUrl(newBannerUrl);
      toast({
        title: 'Banner atualizado',
        description: 'A imagem do banner foi salva com sucesso.',
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: 'Erro ao fazer upload',
        description: 'Não foi possível salvar a imagem do banner.',
        variant: 'destructive',
      });
    } finally {
      setUploadingBanner(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBanner = async () => {
    if (!bannerUrl) return;

    setRemovingBanner(true);
    try {
      // Delete from storage
      const fileName = bannerUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('banners').remove([fileName]);
      }

      // Update system_settings with tenant_id filter
      const { error } = await supabase
        .from('system_settings')
        .update({ value: null })
        .eq('key', 'doctor_portal_banner')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      setBannerUrl(null);
      toast({
        title: 'Banner removido',
        description: 'O banner foi removido com sucesso.',
      });
    } catch (error) {
      console.error('Error removing banner:', error);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o banner.',
        variant: 'destructive',
      });
    } finally {
      setRemovingBanner(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    
    setSaving(true);
    try {
      // Upsert to handle both insert and update cases
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'doctor_portal_link',
          value: doctorPortalLink,
          tenant_id: tenantId,
          description: 'Link externo exibido no botão do Portal do Médico'
        }, { onConflict: 'tenant_id,key' });

      if (error) throw error;

      toast({
        title: 'Configurações salvas',
        description: 'As configurações foram atualizadas com sucesso.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Link do Portal do Médico
            </CardTitle>
            <CardDescription>
              Configure o link externo que será exibido no botão do Portal do Médico. 
              Este link pode direcionar para um sistema externo, formulário ou página adicional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doctor-portal-link">URL do Link</Label>
              <Input
                id="doctor-portal-link"
                type="url"
                placeholder="https://exemplo.com/formulario"
                value={doctorPortalLink}
                onChange={(e) => setDoctorPortalLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para ocultar o botão no portal do médico.
              </p>
            </div>
            
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Banner do Portal do Médico
            </CardTitle>
            <CardDescription>
              Configure uma imagem de banner que será exibida no topo do Portal do Médico.
              O banner será clicável e redirecionará para o link configurado acima.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Banner Preview */}
            <div className="space-y-2">
              <Label>Preview do Banner</Label>
              <div className="border rounded-lg overflow-hidden bg-muted">
                {bannerUrl ? (
                  <img 
                    src={bannerUrl} 
                    alt="Banner atual" 
                    className="w-full h-auto max-h-48 object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-sm">Nenhum banner configurado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Controls */}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBannerUpload}
                className="hidden"
                id="banner-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBanner}
              >
                {uploadingBanner ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Imagem
                  </>
                )}
              </Button>
              
              {bannerUrl && (
                <Button
                  variant="destructive"
                  onClick={handleRemoveBanner}
                  disabled={removingBanner}
                >
                  {removingBanner ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Removendo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover Banner
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium">Instruções para o banner</h4>
              <div className="text-xs text-muted-foreground space-y-2">
                <p><strong>Tamanho ideal:</strong> 1200x400 pixels (proporção 3:1)</p>
                <p><strong>Formatos aceitos:</strong> JPG, PNG, WebP</p>
                <p><strong>Tamanho máximo:</strong> 5MB</p>
                <div className="pt-2 border-t border-border">
                  <p className="font-medium text-foreground mb-1">Altura exibida por dispositivo:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Mobile: até 128px</li>
                    <li>Tablet pequeno: até 192px</li>
                    <li>Tablet: até 224px</li>
                    <li>Desktop: até 256px</li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="font-medium text-foreground mb-1">Dicas:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Evite texto pequeno (pode ficar ilegível no mobile)</li>
                    <li>Mantenha elementos importantes centralizados</li>
                    <li>O banner será clicável e abrirá o link configurado acima</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
