import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export default function AutorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/autor');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = authSchema.parse({ email, password });
      setLoading(true);

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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(232,169,23,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(232,169,23,0.05) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 100%, rgba(232,169,23,0.06) 0%, transparent 50%),
          linear-gradient(160deg, #1a1a1a 0%, #2d2525 50%, #1a1a1a 100%)
        `,
      }}
    >
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img
              src="/logos/logo-central-gospel-autor.png"
              alt="Central Gospel Editora"
              className="h-20 object-contain"
            />
          </div>
          <CardDescription className="text-center text-base">
            Entre com suas credenciais para acessar a área do autor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              style={{ backgroundColor: '#E8A917', color: '#1a1a1a' }}
            >
              {loading ? 'Processando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
