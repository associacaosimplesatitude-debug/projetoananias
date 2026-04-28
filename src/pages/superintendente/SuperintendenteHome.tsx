import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useSuperintendente } from "@/hooks/useSuperintendente";

export default function SuperintendenteHome() {
  const { nomeSuperintendente, nomeIgreja } = useSuperintendente();
  const primeiroNome = (nomeSuperintendente || "").split(" ")[0] || "Superintendente";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Olá, {primeiroNome}!
        </h1>
        {nomeIgreja && (
          <p className="text-sm text-muted-foreground mt-1">{nomeIgreja}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Bem-vindo ao seu portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Em breve, esta área terá as ferramentas para você distribuir as
            licenças do seu Plano Superintendente para os alunos da sua igreja,
            acompanhar o progresso e gerenciar os acessos.
          </p>
          <p>Estamos finalizando os últimos detalhes. Volte em breve!</p>
        </CardContent>
      </Card>
    </div>
  );
}
