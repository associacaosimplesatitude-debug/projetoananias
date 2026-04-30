import { useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperintendente } from "@/hooks/useSuperintendente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function SuperintendenteLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isSuperintendente, isLoading: seLoading } = useSuperintendente();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirect =
    new URLSearchParams(location.search).get("redirect") || "/multi-licenca";

  // Redirect when already logged in as SE
  useEffect(() => {
    if (!authLoading && !seLoading && user && isSuperintendente) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, seLoading, user, isSuperintendente, navigate, redirect]);

  if (!authLoading && !seLoading && user && isSuperintendente) {
    return <Navigate to={redirect} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (error) {
        toast({
          title: "Não foi possível entrar",
          description:
            error.message === "Invalid login credentials"
              ? "E-mail ou senha incorretos. Confira os dados enviados no WhatsApp/e-mail."
              : error.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Bem-vindo!", description: "Acessando seu portal..." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal Multi-Licença</CardTitle>
          <CardDescription>
            Acesse com o e-mail e a senha temporária recebidos após sua compra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                placeholder="Senha temporária"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                maxLength={128}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              Problemas para acessar? Fale com o suporte da Editora Central Gospel.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
