import { CheckCircle, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ConfirmacaoWhatsApp = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="flex justify-center gap-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <MessageCircle className="h-12 w-12 text-green-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Seus dados de acesso foram enviados no WhatsApp! 📱
            </h1>
            <p className="text-muted-foreground">
              Verifique suas mensagens para obter o e-mail e senha de acesso ao painel.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p className="font-medium">📩 Enviamos uma mensagem com:</p>
            <ul className="mt-2 space-y-1 text-left list-disc list-inside">
              <li>Seu e-mail de acesso</li>
              <li>Sua senha temporária</li>
              <li>Link direto para o painel</li>
            </ul>
          </div>

          <Button asChild className="w-full" size="lg">
            <Link to="/login/ebd">Já recebi, quero fazer login →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmacaoWhatsApp;
