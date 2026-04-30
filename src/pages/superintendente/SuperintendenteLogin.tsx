import { useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import logoCentralGospel from "@/assets/logo_central_gospel.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperintendente } from "@/hooks/useSuperintendente";
import { useMultiLicencaPacote } from "@/hooks/useMultiLicencaPacote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

const BRAND_PRIMARY = "#1B3A5C";

export default function SuperintendenteLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isSuperintendente, isLoading: seLoading, clienteId } = useSuperintendente();
  const { hasMultiLicencaPacote, isLoading: pacoteLoading } = useMultiLicencaPacote(clienteId);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirect =
    new URLSearchParams(location.search).get("redirect") || "/multi-licenca";

  const ready = !authLoading && !seLoading && (!isSuperintendente || !pacoteLoading);
  const isMultiLicencaCliente = !!user && isSuperintendente && hasMultiLicencaPacote;

  // Redireciona quando autenticado E elegível
  useEffect(() => {
    if (ready && isMultiLicencaCliente) {
      navigate(redirect, { replace: true });
    }
  }, [ready, isMultiLicencaCliente, navigate, redirect]);

  if (ready && isMultiLicencaCliente) {
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
      toast({ title: "Bem-vindo!", description: "Validando seu acesso..." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setSenha("");
  };

  // Estados pós-login
  const loggedSEsemPacote = ready && !!user && isSuperintendente && !hasMultiLicencaPacote;
  const loggedNaoSE = ready && !!user && !isSuperintendente;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3">
          <img
            src={logoCentralGospel}
            alt="Editora Central Gospel"
            className="mx-auto h-auto w-20 object-contain"
          />
          <CardTitle className="text-2xl" style={{ color: BRAND_PRIMARY }}>
            Editora Central Gospel
          </CardTitle>
          <p className="text-sm font-medium text-muted-foreground -mt-2">
            Portal Multi-Licença
          </p>
          <CardDescription>
            Acesse com o e-mail e a senha temporária recebidos após sua compra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loggedSEsemPacote && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Plano Multi-Licença não encontrado</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  Você está logado como Superintendente da Gestão EBD tradicional.
                  Esta área é exclusiva para clientes do <strong>Plano Multi-Licença</strong>.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => navigate("/ebd/dashboard")}
                    style={{ backgroundColor: BRAND_PRIMARY, color: "white" }}
                  >
                    Ir para o Painel Gestão EBD
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                    Sair
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {loggedNaoSE && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Acesso não disponível</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  Login realizado, mas sua conta não tem acesso ao Plano Multi-Licença.
                  Verifique se você comprou o plano ou entre em contato com o suporte.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full"
                >
                  Sair e tentar com outra conta
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!loggedSEsemPacote && !loggedNaoSE && (
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
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                style={{ backgroundColor: BRAND_PRIMARY, color: "white" }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t text-center">
            <a
              href="https://centralgospel.com.br/multi-licenca"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              Não é cliente ainda? Conheça o Plano Multi-Licença
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
