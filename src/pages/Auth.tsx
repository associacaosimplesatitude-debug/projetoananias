import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import logoAnanias from '@/assets/logo_ananias.png';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: brandingSettings } = useBrandingSettings();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      handlePostLoginRedirect();
    }
  }, [user]);

  const handlePostLoginRedirect = async () => {
    if (!user) return;
    
    try {
      // Track lead login - update ultimo_login_ebd for leads
      if (user.email) {
        await supabase
          .from('ebd_leads_reativacao')
          .update({ ultimo_login_ebd: new Date().toISOString() })
          .eq('email', user.email);
      }

      // PRIMEIRO: Verificar se é vendedor (pelo email) - deve ter prioridade
      const { data: vendedorData } = await supabase
        .from('vendedores')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      if (vendedorData) {
        navigate('/vendedor');
        return;
      }

      // Verificar se é superintendente (cadastrado via vendedor em ebd_clientes)
      const { data: superintendenteData } = await supabase
        .from('ebd_clientes')
        .select('id, status_ativacao_ebd')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .maybeSingle();

      if (superintendenteData) {
        navigate('/ebd/dashboard');
        return;
      }

      // Buscar role do usuário
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // Se for admin, vai para o dashboard de admin
      if (roleData?.role === 'admin') {
        navigate('/admin');
        return;
      }

      // Se for tesoureiro ou secretário, vai direto para o dashboard
      if (roleData?.role === 'tesoureiro' || roleData?.role === 'secretario') {
        navigate('/dashboard');
        return;
      }

      // Se for client, verifica o status da igreja
      if (roleData?.role === 'client') {
        const { data: church } = await supabase
          .from('churches')
          .select('process_status')
          .eq('user_id', user.id)
          .maybeSingle();

        // Redirecionar baseado no status
        if (church?.process_status === 'completed') {
          navigate('/dashboard');
        } else {
          navigate('/');
        }
        return;
      }

      // Fallback: vai para página inicial
      navigate('/');
    } catch (error) {
      console.error('Erro ao redirecionar após login:', error);
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = authSchema.parse({
        email,
        password,
        fullName: isLogin ? undefined : fullName,
      });
      
      setLoading(true);
      
      if (isLogin) {
        const { error } = await signIn(validatedData.email, validatedData.password);
        if (error) {
          toast({
            title: 'Erro ao fazer login',
            description: error.message === 'Invalid login credentials' 
              ? 'Email ou senha incorretos' 
              : error.message,
            variant: 'destructive',
          });
        }
        // O redirecionamento será feito pelo useEffect
      } else {
        const { error } = await signUp(validatedData.email, validatedData.password, validatedData.fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Erro ao criar conta',
              description: 'Este email já está cadastrado. Faça login.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Erro ao criar conta',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Conta criada com sucesso!',
            description: 'Você já pode fazer login.',
          });
          setIsLogin(true);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Erro de validação',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loginLogoUrl = brandingSettings?.login_logo_url || logoAnanias;
  const accentColor = brandingSettings?.accent_color || '#c89c5a';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={loginLogoUrl} alt="Logo" className="h-20" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? 'Fazer Login' : 'Criar Conta'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? 'Entre com suas credenciais para acessar o sistema' 
              : 'Crie sua conta para começar'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              style={{ backgroundColor: accentColor, color: 'white' }}
            >
              {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="hover:underline font-medium"
              style={{ color: accentColor }}
            >
              {isLogin 
                ? 'Não tem uma conta? Cadastre-se' 
                : 'Já tem uma conta? Faça login'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
