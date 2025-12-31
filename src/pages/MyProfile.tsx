import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function MyProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [ebdClienteId, setEbdClienteId] = useState<string | null>(null);
  const [dataAniversarioSuperintendente, setDataAniversarioSuperintendente] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);

    const [profileRes, ebdClienteRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('id', user.id)
        .single(),
      supabase
        .from('ebd_clientes')
        .select('id, data_aniversario_superintendente')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .limit(1),
    ]);

    const { data: profileData } = profileRes;
    const { data: ebdClientes } = ebdClienteRes;

    if (profileData) {
      setFullName(profileData.full_name || '');
      setEmail(profileData.email || '');
      if (profileData.avatar_url) {
        const { data: urlData } = supabase.storage
          .from('profile-avatars')
          .getPublicUrl(profileData.avatar_url);
        setAvatarUrl(urlData.publicUrl);
      }
    }

    const ebdCliente = ebdClientes && ebdClientes.length > 0 ? ebdClientes[0] : null;
    setEbdClienteId(ebdCliente?.id ?? null);
    setDataAniversarioSuperintendente(ebdCliente?.data_aniversario_superintendente || '');

    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file || !user) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await fetchProfile();
      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao fazer upload da foto: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [{ error: profileError }, { error: clienteError }] = await Promise.all([
        supabase
          .from('profiles')
          .update({ full_name: fullName, email: email })
          .eq('id', user.id),
        ebdClienteId
          ? supabase
              .from('ebd_clientes')
              .update({
                data_aniversario_superintendente: dataAniversarioSuperintendente || null,
              })
              .eq('id', ebdClienteId)
          : Promise.resolve({ error: null } as any),
      ]);

      if (profileError) throw profileError;
      if (clienteError) throw clienteError;

      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setChangingPassword(true);
    try {
      // Update password using Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) throw authError;

      // Reset senha_padrao_usada flag
      await supabase
        .from('profiles')
        .update({ senha_padrao_usada: false })
        .eq('id', user.id);

      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao alterar senha: ' + error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>

        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Atualize suas informações e foto de perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={avatarUrl || undefined} alt={fullName || 'Usuário'} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload"
                  disabled={uploading}
                />
                <Label htmlFor="avatar-upload">
                  <Button variant="outline" className="cursor-pointer" asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Alterar Foto
                    </span>
                  </Button>
                </Label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite seu nome completo"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>

              {ebdClienteId && (
                <div>
                  <Label htmlFor="dataAniversarioSuperintendente">Data de aniversário (Superintendente)</Label>
                  <Input
                    id="dataAniversarioSuperintendente"
                    type="date"
                    value={dataAniversarioSuperintendente}
                    onChange={(e) => setDataAniversarioSuperintendente(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Essa data é usada para exibir no card do cliente e liberar o cupom de aniversário.
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription>Atualize sua senha de acesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !newPassword || !confirmPassword} 
              className="w-full"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
