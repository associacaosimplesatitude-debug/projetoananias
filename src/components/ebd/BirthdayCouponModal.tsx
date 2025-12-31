import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, PartyPopper, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface BirthdayCouponModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  nomeCliente: string;
  tipoAniversario: "pastor" | "superintendente";
  onCouponRedeemed: () => void;
}

export function BirthdayCouponModal({
  open,
  onOpenChange,
  clienteId,
  nomeCliente,
  tipoAniversario,
  onCouponRedeemed,
}: BirthdayCouponModalProps) {
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  const handleRedeemCoupon = async () => {
    setRedeeming(true);
    try {
      const currentYear = new Date().getFullYear();

      // Criar crédito na tabela ebd_creditos
      const { error: creditoError } = await supabase
        .from("ebd_creditos")
        .insert({
          cliente_id: clienteId,
          tipo: "cupom_aniversario",
          valor: 50,
          descricao: `Cupom de aniversário ${currentYear} - ${
            tipoAniversario === "pastor" ? "Pastor" : "Superintendente"
          }`,
          validade: new Date(currentYear, 11, 31).toISOString().split("T")[0], // Válido até 31/12 do ano atual
        });

      if (creditoError) throw creditoError;

      // Marcar cupom como resgatado no ebd_clientes
      const { error: clienteError } = await supabase
        .from("ebd_clientes")
        .update({
          cupom_aniversario_usado: true,
          cupom_aniversario_ano: currentYear,
          modal_aniversario_visualizado_em: new Date().toISOString(),
        })
        .eq("id", clienteId);

      if (clienteError) throw clienteError;

      // Trigger confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FF69B4", "#00CED1", "#9370DB"],
      });

      setRedeemed(true);
      toast.success("Cupom de R$50 resgatado com sucesso!");
      onCouponRedeemed();
    } catch (error) {
      console.error("Erro ao resgatar cupom:", error);
      toast.error("Erro ao resgatar cupom. Tente novamente.");
    } finally {
      setRedeeming(false);
    }
  };

  const handleClose = async () => {
    // Marcar que visualizou o modal
    await supabase
      .from("ebd_clientes")
      .update({
        modal_aniversario_visualizado_em: new Date().toISOString(),
      })
      .eq("id", clienteId);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center animate-pulse">
            <PartyPopper className="h-10 w-10 text-white" />
          </div>
          <DialogTitle className="text-2xl text-center">
            🎉 Feliz Aniversário! 🎂
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {tipoAniversario === "pastor"
              ? "Parabéns pelo aniversário do Pastor!"
              : "Parabéns pelo seu aniversário!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Video placeholder - você pode substituir por um vídeo real */}
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-4 text-center">
              <div className="mb-3 text-4xl">🎈🎊🎁</div>
              <p className="text-sm text-muted-foreground">
                A família REOBOTE EBD deseja um dia abençoado e cheio de alegria
                para você e toda a {nomeCliente}!
              </p>
            </CardContent>
          </Card>

          {!redeemed ? (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Gift className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-bold text-green-700">
                    Presente Especial!
                  </span>
                </div>

                <div className="text-center">
                  <Badge className="bg-green-500 hover:bg-green-600 text-lg px-4 py-2">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Cupom de R$ 50,00
                  </Badge>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  ✓ Válido para seu próximo pedido
                  <br />
                  ✓ Você paga apenas o frete
                  <br />✓ Cumulativo com desconto de setup progressivo
                </p>

                <Button
                  onClick={handleRedeemCoupon}
                  disabled={redeeming}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {redeeming ? (
                    "Resgatando..."
                  ) : (
                    <>
                      <Gift className="mr-2 h-4 w-4" />
                      Resgatar Meu Cupom
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-green-100 to-emerald-100 border-green-300">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <p className="text-lg font-bold text-green-700">
                  Cupom Resgatado!
                </p>
                <p className="text-sm text-muted-foreground">
                  Seu crédito de R$ 50,00 já está disponível para uso no próximo
                  pedido.
                </p>
                <Button onClick={() => onOpenChange(false)} variant="outline">
                  Continuar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
