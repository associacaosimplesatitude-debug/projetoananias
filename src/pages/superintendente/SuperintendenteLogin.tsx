import { useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

const BRAND_PRIMARY = "#1B3A5C";
const LOG_PREFIX = "[SuperintendenteLogin]";

const forgotSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
});
type ForgotValues = z.infer<typeof forgotSchema>;

export default function SuperintendenteLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isSuperintendente, isLoading: seLoading, clienteId } = useSuperintendente();
  const { hasMultiLicencaPacote, isLoading: pacoteLoading } = useMultiLicencaPacote(clienteId);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [passwordCheckCompleted, setPasswordCheckCompleted] = useState(false);

  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const redirect =
    new URLSearchParams(location.search).get("redirect") || "/multi-licenca";

  const ready = !authLoading && !seLoading && (!isSuperintendente || !pacoteLoading);
  const isMultiLicencaCliente = !!user && isSuperintendente && hasMultiLicencaPacote;

  // Verifica se cliente precisa trocar senha
  useEffect(() => {
    if (!ready || !user || !isMultiLicencaCliente) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ebd_clientes")
        .select("deve_trocar_senha")
        .eq("superintendente_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.deve_trocar_senha) {
        console.log(`${LOG_PREFIX} cliente precisa trocar senha — redirecionando`);
        setMustChangePassword(true);
        navigate("/multi-licenca/redefinir-senha", { replace: true });
      }
      setPasswordCheckCompleted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, isMultiLicencaCliente, navigate]);

  // Redireciona quando autenticado E elegível E não precisa trocar senha
  useEffect(() => {
    if (ready && isMultiLicencaCliente && passwordCheckCompleted && !mustChangePassword) {
      navigate(redirect, { replace: true });
    }
  }, [ready, isMultiLicencaCliente, passwordCheckCompleted, mustChangePassword, navigate, redirect]);

  if (ready && isMultiLicencaCliente && passwordCheckCompleted && !mustChangePassword) {
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

  const handleForgotSubmit = async (values: ForgotValues) => {
    setForgotSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/multi-licenca/redefinir-senha`,
      });
      if (error) {
        console.error(`${LOG_PREFIX} resetPasswordForEmail error`, error);
        toast({
          title: "Erro",
          description:
            "Não foi possível enviar o link agora. Tente novamente em alguns minutos.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Verifique seu e-mail",
        description:
          "Se este e-mail estiver cadastrado, você receberá um link em alguns minutos.",
      });
      setForgotOpen(false);
      forgotForm.reset();
    } finally {
      setForgotSubmitting(false);
    }
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

          {!loggedSEsemPacote && !loggedNaoSE && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
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

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar acesso</DialogTitle>
            <DialogDescription>
              Digite seu e-mail. Enviaremos um link para você criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <Form {...forgotForm}>
            <form
              onSubmit={forgotForm.handleSubmit(handleForgotSubmit)}
              className="space-y-4"
            >
              <FormField
                control={forgotForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={forgotSubmitting}
                  style={{ backgroundColor: BRAND_PRIMARY, color: "white" }}
                >
                  {forgotSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
