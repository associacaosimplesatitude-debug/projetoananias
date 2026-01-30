import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink, Sparkles } from "lucide-react";

interface FinalCTASectionProps {
  preco: number;
  onBuyClick: () => void;
}

export function FinalCTASection({ preco, onBuyClick }: FinalCTASectionProps) {
  return (
    <section className="py-16 bg-gradient-to-r from-green-600 via-green-700 to-green-600 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-yellow-300" />
            <span className="text-green-100 font-medium">Garanta já o seu exemplar!</span>
            <Sparkles className="h-6 w-6 text-yellow-300" />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Adquira seu exemplar agora!
          </h2>

          <p className="text-green-100 mb-8 text-lg">
            Mergulhe nesta leitura inspiradora e enriqueça sua compreensão bíblica sobre um dos períodos mais importantes da história de Israel.
          </p>

          <Button
            size="lg"
            variant="secondary"
            onClick={onBuyClick}
            className="bg-white hover:bg-gray-100 text-green-700 text-lg px-10 py-7 shadow-xl hover:shadow-2xl transition-all duration-300 font-bold"
          >
            <ShoppingCart className="h-6 w-6 mr-3" />
            Comprar por{" "}
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(preco)}
            <ExternalLink className="h-5 w-5 ml-3" />
          </Button>
        </div>
      </div>
    </section>
  );
}
