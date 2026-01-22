import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Crown, Wallet, Clock } from "lucide-react";

interface ComissaoResumoAdminCardProps {
  aPagar: number;
  pendentes: number;
  quantidadeAPagar: number;
  quantidadePendentes: number;
  onVerMinhas: (status: 'liberada' | 'pendente') => void;
}

export function ComissaoResumoAdminCard({ 
  aPagar,
  pendentes,
  quantidadeAPagar,
  quantidadePendentes,
  onVerMinhas
}: ComissaoResumoAdminCardProps) {
  if (aPagar === 0 && pendentes === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-amber-50/50 to-yellow-50/50 border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
          <Crown className="h-5 w-5" />
          Minhas Comissões (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* A Pagar */}
          <div 
            className="flex items-center justify-between p-4 bg-white/80 rounded-lg border border-green-100 cursor-pointer group hover:bg-white transition-colors"
            onClick={() => onVerMinhas('liberada')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <span className="text-sm text-muted-foreground block">A Pagar</span>
                <span className="text-xl font-bold text-green-600">
                  R$ {aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-muted-foreground block">
                  {quantidadeAPagar} comiss{quantidadeAPagar === 1 ? 'ão' : 'ões'}
                </span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Pendentes */}
          <div 
            className="flex items-center justify-between p-4 bg-white/80 rounded-lg border border-yellow-100 cursor-pointer group hover:bg-white transition-colors"
            onClick={() => onVerMinhas('pendente')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <span className="text-sm text-muted-foreground block">Pendentes</span>
                <span className="text-xl font-bold text-yellow-600">
                  R$ {pendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-muted-foreground block">
                  {quantidadePendentes} comiss{quantidadePendentes === 1 ? 'ão' : 'ões'}
                </span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
