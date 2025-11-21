import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Palette } from 'lucide-react';
import { useBrandingSettings, useUpdateBrandingSettings, useUploadBrandingImage } from '@/hooks/useBrandingSettings';

export default function BrandingCustomization() {
  const { data: settings, isLoading } = useBrandingSettings();
  const updateSettings = useUpdateBrandingSettings();
  const uploadImage = useUploadBrandingImage();

  const [navColor, setNavColor] = useState(settings?.nav_background_color || '#1a2d40');
  const [accentColor, setAccentColor] = useState(settings?.accent_color || '#c89c5a');

  React.useEffect(() => {
    if (settings) {
      setNavColor(settings.nav_background_color);
      setAccentColor(settings.accent_color);
    }
  }, [settings]);

  const handleNavLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage.mutate({ file, type: 'nav' });
    }
  };

  const handleLoginLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage.mutate({ file, type: 'login' });
    }
  };

  const handleSaveColors = () => {
    updateSettings.mutate({
      nav_background_color: navColor,
      accent_color: accentColor,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Personalização da Aparência</h1>
        <p className="text-muted-foreground mt-2">
          Customize a identidade visual de toda a plataforma
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Logos Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Logos
            </CardTitle>
            <CardDescription>
              Faça upload dos logos que aparecerão na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nav Logo */}
            <div className="space-y-3">
              <Label htmlFor="nav-logo">Logo da Barra de Navegação</Label>
              {settings?.nav_logo_url && (
                <div className="border rounded-lg p-4 bg-muted">
                  <img
                    src={settings.nav_logo_url}
                    alt="Logo atual da navegação"
                    className="h-12 object-contain"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  id="nav-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleNavLogoUpload}
                  disabled={uploadImage.isPending}
                />
                {uploadImage.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>

            {/* Login Logo */}
            <div className="space-y-3">
              <Label htmlFor="login-logo">Logo da Página de Login</Label>
              {settings?.login_logo_url && (
                <div className="border rounded-lg p-4 bg-muted">
                  <img
                    src={settings.login_logo_url}
                    alt="Logo atual do login"
                    className="h-16 object-contain"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  id="login-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLoginLogoUpload}
                  disabled={uploadImage.isPending}
                />
                {uploadImage.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Cores do Tema
            </CardTitle>
            <CardDescription>
              Defina as cores principais da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nav Background Color */}
            <div className="space-y-3">
              <Label htmlFor="nav-color">Cor Principal da Barra de Navegação</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="nav-color"
                  type="color"
                  value={navColor}
                  onChange={(e) => setNavColor(e.target.value)}
                  className="w-20 h-12 cursor-pointer"
                />
                <Input
                  type="text"
                  value={navColor}
                  onChange={(e) => setNavColor(e.target.value)}
                  placeholder="#1a2d40"
                  className="flex-1"
                />
              </div>
              <div
                className="h-12 rounded-md border"
                style={{ backgroundColor: navColor }}
              />
            </div>

            {/* Accent Color */}
            <div className="space-y-3">
              <Label htmlFor="accent-color">Cor de Destaque (Botões e Links)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="accent-color"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-20 h-12 cursor-pointer"
                />
                <Input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#c89c5a"
                  className="flex-1"
                />
              </div>
              <div
                className="h-12 rounded-md border"
                style={{ backgroundColor: accentColor }}
              />
            </div>

            <Button
              onClick={handleSaveColors}
              disabled={updateSettings.isPending}
              className="w-full"
            >
              {updateSettings.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar Cores
            </Button>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>
              As mudanças serão aplicadas automaticamente após salvar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div
                  className="px-4 py-2 rounded-md text-white font-medium"
                  style={{ backgroundColor: navColor }}
                >
                  Barra de Navegação
                </div>
              </div>
              <div className="flex gap-2">
                <Button style={{ backgroundColor: accentColor, color: 'white' }}>
                  Botão de Ação
                </Button>
                <Button
                  variant="outline"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  Botão Secundário
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
