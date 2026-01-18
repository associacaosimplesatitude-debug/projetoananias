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
import { useDomainBranding } from '@/hooks/useDomainBranding';
import { pushLoginSuccess, pushCadastroSuccess } from '@/lib/gtm';

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
  const domainBranding = useDomainBranding();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      handlePostLoginRedirect();
    }
  }, [user]);

  const handlePostLoginRedirect = async () => {
    if (!user || !user.email) return;
    
    const userEmail = user.email.toLowerCase().trim();
    console.log('=== POST LOGIN REDIRECT ===');
    console.log('User ID:', user.id);
    console.log('User Email:', userEmail);
    
    try {
      // 1. VENDEDOR - verificar pelo email (CASE INSENSITIVE)
      const { data: vendedorData, error: vendedorError } = await supabase
        .from('vendedores')
        .select('id')
        .ilike('email', userEmail)
        .maybeSingle();

      console.log('Vendedor check:', { vendedorData, vendedorError });

      if (vendedorData) {
        pushLoginSuccess(user.id, 'Vendedor');
        console.log('Redirecting to /vendedor');
        navigate('/vendedor');
        return;
      }

      // 2. SUPERINTENDENTE (ebd_clientes) - verificar pelo user_id
      const { data: superintendenteData, error: superintendenteError } = await supabase
        .from('ebd_clientes')
        .select('id, status_ativacao_ebd')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .maybeSingle();

      console.log('Superintendente check:', { superintendenteData, superintendenteError });

      if (superintendenteData) {
        await supabase
          .from('ebd_clientes')
          .update({ ultimo_login: new Date().toISOString() })
          .eq('id', superintendenteData.id);
        pushLoginSuccess(user.id, 'Superintendente');
        console.log('Redirecting to /ebd/dashboard (superintendente)');
        navigate('/ebd/dashboard');
        return;
      }

      // 2.1 SUPERINTENDENTE via ebd_user_roles (professor promovido)
      const { data: superRoleData } = await supabase
        .from('ebd_user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'superintendente')
        .limit(1);

      if (superRoleData && superRoleData.length > 0) {
        pushLoginSuccess(user.id, 'Superintendente');
        console.log('Redirecting to /ebd/dashboard (superintendente role)');
        navigate('/ebd/dashboard');
        return;
      }

      // 3. LEAD DE REATIVAÇÃO - verificar pelo email (CRÍTICO!)
      // Usar RPC ou query direta sem filtro de conta_criada primeiro
      const { data: leadData, error: leadError } = await supabase
        .from('ebd_leads_reativacao')
        .select('id, conta_criada, email, lead_score')
        .ilike('email', userEmail)
        .maybeSingle();

      console.log('Lead check:', { leadData, leadError, userEmail });

      if (leadData) {
        // Atualizar lead_score para Quente e ultimo_login_ebd
        const { error: updateError } = await supabase
          .from('ebd_leads_reativacao')
          .update({ 
            ultimo_login_ebd: new Date().toISOString(),
            lead_score: 'Quente',
            conta_criada: true
          })
          .eq('id', leadData.id);
        
        console.log('Lead update result:', { updateError });
        console.log('Redirecting to /ebd/dashboard (lead reativacao)');
        navigate('/ebd/dashboard');
        return;
      }

      // 4. ADMIN - verificar pela role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Role check:', { roleData, roleError });

      if (roleData?.role === 'admin') {
        pushLoginSuccess(user.id, 'Admin');
        console.log('Redirecting to /admin');
        navigate('/admin');
        return;
      }

      // 5. GERENTE EBD - redirecionar para Admin EBD
      if (roleData?.role === 'gerente_ebd') {
        console.log('Redirecting to /admin/ebd (gerente_ebd)');
        navigate('/admin/ebd');
        return;
      }

      // 5.1. FINANCEIRO - redirecionar para Aprovação Faturamento
      if (roleData?.role === 'financeiro') {
        console.log('Redirecting to /admin/ebd/aprovacao-faturamento (financeiro)');
        navigate('/admin/ebd/aprovacao-faturamento');
        return;
      }

      // 6. PROFESSOR (prioridade sobre "client" / "/dashboard")
      const { data: professorData } = await supabase
        .from('ebd_professores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (professorData) {
        pushLoginSuccess(user.id, 'Professor');
        console.log('Redirecting to /ebd/professor');
        navigate('/ebd/professor');
        return;
      }

      // 7. ALUNO (prioridade sobre "client" / "/dashboard")
      const { data: alunoData } = await supabase
        .from('ebd_alunos')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (alunoData) {
        pushLoginSuccess(user.id, 'Aluno');
        console.log('Redirecting to /ebd/aluno');
        navigate('/ebd/aluno');
        return;
      }

      // 8. TESOUREIRO/SECRETÁRIO
      if (roleData?.role === 'tesoureiro' || roleData?.role === 'secretario') {
        console.log('Redirecting to /dashboard (tesoureiro/secretario)');
        navigate('/dashboard');
        return;
      }

      // 9. CLIENT - verificar igreja
      if (roleData?.role === 'client') {
        const { data: church } = await supabase
          .from('churches')
          .select('process_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (church?.process_status === 'completed') {
          console.log('Redirecting to /dashboard (client completed)');
          navigate('/dashboard');
        } else {
          console.log('Redirecting to / (client in progress)');
          navigate('/');
        }
        return;
      }

      // 9. FALLBACK - ir para página inicial
      console.log('No specific role found, redirecting to /');
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
          // Push cadastro success - user created (tipo Cliente/Igreja)
          pushCadastroSuccess(email, 'Cliente/Igreja');
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

  // Use domain branding as primary source (based on current hostname)
  // This ensures each domain shows its own branding without redirects
  const loginLogoUrl = domainBranding.logoUrl;
  const accentColor = domainBranding.accentColor;
  const appName = domainBranding.appName;

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
