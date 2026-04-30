import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSuperintendente } from "@/hooks/useSuperintendente";
import { useMultiLicencaPacote } from "@/hooks/useMultiLicencaPacote";
import { supabase } from "@/integrations/supabase/client";

export function RequireSuperintendente() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isLoading, isSuperintendente, clienteId } = useSuperintendente();
  const { hasMultiLicencaPacote, isLoading: pacoteLoading } = useMultiLicencaPacote(clienteId);

  if (authLoading || (user && (isLoading || (isSuperintendente && pacoteLoading)))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/multi-licenca/login?redirect=${redirect}`} replace />;
  }

  if (!isSuperintendente || !hasMultiLicencaPacote) {
    const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.href = "/multi-licenca/login";
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Área restrita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este portal é exclusivo para clientes do <strong>Plano Multi-Licença</strong> com pacote ativo.
            </p>
            <p className="text-sm text-muted-foreground">
              Se você é cliente, faça login com a conta correta. Caso contrário, conheça o plano em{" "}
              <a
                href="https://centralgospel.com.br/multi-licenca"
                target="_blank"
                rel="noreferrer"
                className="underline text-primary"
              >
                centralgospel.com.br/multi-licenca
              </a>
              .
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleLogout}>
                Sair
              </Button>
              <Button asChild className="flex-1">
                <a href="/">Voltar ao início</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
