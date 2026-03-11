import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Smartphone, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface DeviceBloqueadoProps {
  licencaAlunoId: string;
  trocaJaSolicitada: boolean;
}

export default function DeviceBloqueado({ licencaAlunoId, trocaJaSolicitada }: DeviceBloqueadoProps) {
  const [requesting, setRequesting] = useState(false);
  const [solicitada, setSolicitada] = useState(trocaJaSolicitada);

  const solicitarTroca = async () => {
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("revista_licenca_alunos")
        .update({
          troca_dispositivo_solicitada: true,
          troca_solicitada_em: new Date().toISOString(),
        })
        .eq("id", licencaAlunoId);

      if (error) throw error;
      setSolicitada(true);
      toast.success("Solicitação enviada ao seu Superintendente!");
    } catch {
      toast.error("Erro ao solicitar troca. Tente novamente.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="border border-border/40 shadow-sm max-w-md w-full">
        <CardContent className="py-12 text-center space-y-6">
          <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="h-10 w-10 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              Acesso bloqueado neste dispositivo
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sua conta já está ativa em outro aparelho. Para usar neste dispositivo,
              solicite a troca ao seu Superintendente.
            </p>
          </div>

          {solicitada ? (
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <Smartphone className="h-6 w-6 mx-auto text-primary" />
              <p className="text-sm font-medium text-foreground">
                Troca solicitada!
              </p>
              <p className="text-xs text-muted-foreground">
                Aguarde seu Superintendente aprovar a troca de dispositivo.
              </p>
            </div>
          ) : (
            <Button
              onClick={solicitarTroca}
              disabled={requesting}
              className="w-full"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              {requesting ? "Enviando..." : "Solicitar Troca de Dispositivo"}
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20com%20a%20Revista%20Virtual", "_blank")}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Falar com Suporte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
