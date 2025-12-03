import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Link2, RefreshCw, CheckCircle2, XCircle, Save, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlingConfig {
  id: string;
  client_id: string | null;
  client_secret: string | null;
  redirect_uri: string | null;
  access_token: string | null;
  refresh_token: string | null;
  loja_id: number | null;
  token_expires_at: string | null;
}

const BlingIntegration = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: '',
    redirect_uri: '',
    loja_id: 205797806,
  });

  // URL do callback gerado pelo Lovable
  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bling-callback`;

  const { data: config, isLoading } = useQuery({
    queryKey: ['bling-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bling_config' as any)
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as BlingConfig;
    },
  });

  useEffect(() => {
    if (config) {
      setFormData({
        client_id: config.client_id || '',
        client_secret: config.client_secret || '',
        redirect_uri: config.redirect_uri || callbackUrl,
        loja_id: config.loja_id || 205797806,
      });
    }
  }, [config, callbackUrl]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('bling_config' as any)
        .update({
          client_id: data.client_id,
          client_secret: data.client_secret,
          redirect_uri: data.redirect_uri,
          loja_id: data.loja_id,
        })
        .eq('id', config?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleSave = () => {
    if (!formData.client_id || !formData.client_secret) {
      toast.error('Client ID e Client Secret são obrigatórios');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleConnectBling = () => {
    if (!formData.client_id || !formData.redirect_uri) {
      toast.error('Configure o Client ID e Redirect URI primeiro');
      return;
    }

    // Escopos necessários para a integração
    const scopes = [
      'produtos',
      'produtos.alterar',
      'pedidos.vendas',
      'pedidos.vendas.alterar',
      'estoques',
      'estoques.alterar',
      'contatos',
      'contatos.alterar'
    ].join('+');

    const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${formData.client_id}&redirect_uri=${encodeURIComponent(formData.redirect_uri)}&scope=${scopes}&state=bling_auth`;

    window.open(authUrl, '_blank');
  };

  const handleRefreshToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bling-refresh-token');
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });
      toast.success('Token renovado com sucesso!');
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      toast.error('Erro ao renovar token');
    }
  };

  const handleSyncProducts = async () => {
    try {
      toast.info('Sincronizando produtos...');
      const { data, error } = await supabase.functions.invoke('bling-sync-products');
      if (error) throw error;
      
      toast.success(`Sincronização concluída! ${data?.count || 0} produtos atualizados.`);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar produtos');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL copiada para a área de transferência!');
  };

  const isConnected = !!config?.access_token;
  const tokenExpired = config?.token_expires_at ? new Date(config.token_expires_at) < new Date() : false;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Integração Bling</h1>
          <p className="text-muted-foreground">Configure a integração com o sistema Bling ERP</p>
        </div>
      </div>

      {/* Status da Conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              tokenExpired ? (
                <XCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            Status da Conexão
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? tokenExpired 
                ? 'Token expirado - Clique em Renovar Token'
                : 'Conectado ao Bling'
              : 'Não conectado'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={handleConnectBling} disabled={!formData.client_id}>
            <Link2 className="h-4 w-4 mr-2" />
            {isConnected ? 'Reconectar' : 'Conectar Bling'}
          </Button>
          {isConnected && (
            <>
              <Button variant="outline" onClick={handleRefreshToken}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Renovar Token
              </Button>
              <Button variant="secondary" onClick={handleSyncProducts}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Produtos
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Redirect URI */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            URL de Callback (Redirect URI)
          </CardTitle>
          <CardDescription>
            Use esta URL no campo "Link de Redirecionamento" nas configurações do app Bling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input 
              value={callbackUrl} 
              readOnly 
              className="font-mono text-sm bg-background"
            />
            <Button variant="outline" onClick={() => copyToClipboard(callbackUrl)}>
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações da API</CardTitle>
          <CardDescription>
            Insira as credenciais do seu aplicativo Bling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID</Label>
              <Input
                id="client_id"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                placeholder="Insira o Client ID do Bling"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_secret">Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                placeholder="Insira o Client Secret do Bling"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirect_uri">Redirect URI</Label>
              <Input
                id="redirect_uri"
                value={formData.redirect_uri}
                onChange={(e) => setFormData({ ...formData, redirect_uri: e.target.value })}
                placeholder="URL de callback"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loja_id">Loja ID</Label>
              <Input
                id="loja_id"
                type="number"
                value={formData.loja_id}
                onChange={(e) => setFormData({ ...formData, loja_id: parseInt(e.target.value) })}
                placeholder="ID da Loja no Bling"
              />
            </div>
          </div>

          {/* Tokens (apenas visualização) */}
          {isConnected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  value={config?.access_token ? '••••••••••••••••' : 'Não configurado'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>Refresh Token</Label>
                <Input
                  value={config?.refresh_token ? '••••••••••••••••' : 'Não configurado'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {config?.token_expires_at && (
                <div className="space-y-2 col-span-2">
                  <Label>Token expira em</Label>
                  <Input
                    value={new Date(config.token_expires_at).toLocaleString('pt-BR')}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlingIntegration;
