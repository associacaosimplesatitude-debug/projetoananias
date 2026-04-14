import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SorteioAge26Obrigado() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f6f5f8" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <Card className="max-w-md w-full border-0 shadow-2xl bg-white">
        <CardContent className="p-8 md:p-10 text-center space-y-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(4,95,116,0.1)" }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: "#045f74" }} />
          </div>

          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "#2c3061", fontFamily: "'Playfair Display', serif" }}
          >
            Inscrição confirmada!
          </h1>

          <p className="text-lg" style={{ color: "#045f74", fontFamily: "Inter, sans-serif" }}>
            Você está participando do sorteio <strong>AGE26</strong>.
          </p>

          <p style={{ color: "rgba(44,48,97,0.6)", fontFamily: "Inter, sans-serif" }}>
            Os sorteios acontecem durante o evento em João Pessoa, PB. Fique atento(a) para não perder!
          </p>

          <Button
            onClick={() => navigate("/sorteio/age26")}
            className="w-full h-12 text-base font-bold text-white border-0 gap-2"
            style={{ backgroundColor: "#045f74" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a página do evento
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
