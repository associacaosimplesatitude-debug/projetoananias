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

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
});

export default function EBDLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Cores e logo fixos da Gestão EBD
  const accentColor = '#FFC107';
  const appName = 'Gestão EBD';
  const loginLogoUrl = '/logos/logo-ebd-horizontal.png';

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      handlePostLoginRedirect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handlePostLoginRedirect = async () => {
    if (!user || !user.email) return;
    
    const userEmail = user.email.toLowerCase().trim();
    
    try {
      // 1. VENDEDOR - verificar pelo email (CASE INSENSITIVE)
      const { data: vendedorData } = await supabase
        .from('vendedores')
        .select('id')
        .ilike('email', userEmail)
        .maybeSingle();

      if (vendedorData) {
        navigate('/vendedor');
        return;
      }

      // 2. SUPERINTENDENTE (ebd_clientes) - verificar pelo user_id
      const { data: superintendenteData } = await supabase
        .from('ebd_clientes')
        .select('id, status_ativacao_ebd')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .maybeSingle();

      if (superintendenteData) {
        await supabase
          .from('ebd_clientes')
          .update({ ultimo_login: new Date().toISOString() })
          .eq('id', superintendenteData.id);
        navigate('/ebd/dashboard');
        return;
      }

      // 3. LEAD DE REATIVAÇÃO
      const { data: leadData } = await supabase
        .from('ebd_leads_reativacao')
        .select('id, conta_criada, email, lead_score')
        .ilike('email', userEmail)
        .maybeSingle();

      if (leadData) {
        await supabase
          .from('ebd_leads_reativacao')
          .update({ 
            ultimo_login_ebd: new Date().toISOString(),
            lead_score: 'Quente',
            conta_criada: true,
          })
          .eq('id', leadData.id);
        navigate('/ebd/dashboard');
        return;
      }

      // 4. ADMIN / GERENTE / CLIENT etc. – mesma lógica da página Auth padrão
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role === 'admin') {
        navigate('/admin');
        return;
      }

      if (roleData?.role === 'gerente_ebd') {
        navigate('/admin/ebd');
        return;
      }

      if (roleData?.role === 'tesoureiro' || roleData?.role === 'secretario') {
        navigate('/dashboard');
        return;
      }

      if (roleData?.role === 'client') {
        const { data: church } = await supabase
          .from('churches')
          .select('process_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (church?.process_status === 'completed') {
          navigate('/dashboard');
        } else {
          navigate('/');
        }
        return;
      }

      // 5. PROFESSOR
      const { data: professorData } = await supabase
        .from('ebd_professores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (professorData) {
        navigate('/ebd/professor');
        return;
      }

      // 6. ALUNO
      const { data: alunoData } = await supabase
        .from('ebd_alunos')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (alunoData) {
        navigate('/ebd/aluno');
        return;
      }

      // 7. FALLBACK
      navigate('/');
    } catch (error) {
      console.error('Erro ao redirecionar após login EBD:', error);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={loginLogoUrl} alt="Logo Gestão EBD" className="h-20" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? 'Login EBD' : 'Criar Conta EBD'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? `Entre com suas credenciais para acessar o ${appName}` 
              : `Crie sua conta no ${appName}`}
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
