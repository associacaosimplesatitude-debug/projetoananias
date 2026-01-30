import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink } from "lucide-react";

interface HeroSectionProps {
  titulo: string;
  subtitulo?: string | null;
  capaUrl?: string | null;
  capaLocalUrl?: string;
  preco: number;
  onBuyClick: () => void;
}

export function HeroSection({
  titulo,
  subtitulo,
  capaUrl,
  capaLocalUrl,
  preco,
  onBuyClick,
}: HeroSectionProps) {
  const imageSrc = capaLocalUrl || capaUrl;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 py-16 md:py-24">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5YzI3YjAiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLThoLTJ2LTRoMnY0em0tNCA0aC00djJoNHYtMnptMC02aC00djJoNHYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Book Cover */}
          <div className="flex justify-center order-1 md:order-1">
            <div className="relative group">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={titulo}
                  className="max-w-xs md:max-w-sm w-full rounded-lg shadow-2xl transform transition-transform duration-500 group-hover:scale-105 group-hover:rotate-1"
                  style={{
                    boxShadow: "0 25px 50px -12px rgba(139, 69, 19, 0.4), 0 0 0 1px rgba(139, 69, 19, 0.1)",
                  }}
                />
              ) : (
                <div className="w-64 h-96 bg-gradient-to-br from-amber-200 to-amber-400 rounded-lg flex items-center justify-center shadow-2xl">
                  <span className="text-amber-800 font-bold text-xl">{titulo}</span>
                </div>
              )}
              
              {/* Price Badge */}
              <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl shadow-lg transform rotate-2">
                <span className="text-xs font-medium block">Por apenas</span>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(preco)}
                </p>
              </div>
            </div>
          </div>

          {/* Book Info */}
          <div className="space-y-6 text-center md:text-left order-2 md:order-2">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold text-amber-950 mb-3 leading-tight">
                {titulo}
              </h1>
              {subtitulo && (
                <p className="text-lg md:text-xl text-amber-800 font-medium italic">
                  {subtitulo}
                </p>
              )}
            </div>

            <p className="text-amber-700 text-lg">
              Um estudo profundo e acessível sobre um dos períodos mais marcantes da história de Israel.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button
                size="lg"
                onClick={onBuyClick}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Comprar Agora
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
