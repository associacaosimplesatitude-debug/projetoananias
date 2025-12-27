import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, TrendingUp, Target } from "lucide-react";

interface DescontoRevendedorBannerProps {
  valorTotal: number;
}

// Faixas de desconto para revendedores
const FAIXAS = [
  { nome: 'Bronze', valorMinimo: 299.90, desconto: 20, cor: 'bg-amber-600' },
  { nome: 'Prata', valorMinimo: 499.90, desconto: 25, cor: 'bg-slate-400' },
  { nome: 'Ouro', valorMinimo: 699.90, desconto: 30, cor: 'bg-yellow-500' },
];

export function DescontoRevendedorBanner({ valorTotal }: DescontoRevendedorBannerProps) {
  // Determinar faixa atual
  const getFaixaAtual = () => {
    if (valorTotal >= 699.90) return { ...FAIXAS[2], index: 2 };
    if (valorTotal >= 499.90) return { ...FAIXAS[1], index: 1 };
    if (valorTotal >= 299.90) return { ...FAIXAS[0], index: 0 };
    return null;
  };

  const faixaAtual = getFaixaAtual();

  // Calcular próxima faixa e quanto falta
  const getProximaFaixa = () => {
    if (valorTotal >= 699.90) return null; // Já está na faixa máxima
    if (valorTotal >= 499.90) return { faixa: FAIXAS[2], falta: 699.90 - valorTotal };
    if (valorTotal >= 299.90) return { faixa: FAIXAS[1], falta: 499.90 - valorTotal };
    return { faixa: FAIXAS[0], falta: 299.90 - valorTotal };
  };

  const proximaFaixa = getProximaFaixa();

  // Calcular progresso para próxima faixa
  const calcularProgresso = () => {
    if (valorTotal >= 699.90) return 100;
    if (valorTotal >= 499.90) {
      return ((valorTotal - 499.90) / (699.90 - 499.90)) * 100;
    }
    if (valorTotal >= 299.90) {
      return ((valorTotal - 299.90) / (499.90 - 299.90)) * 100;
    }
    return (valorTotal / 299.90) * 100;
  };

  const progresso = calcularProgresso();

  // Cor do ícone baseada na faixa
  const getIconColor = () => {
    if (faixaAtual?.nome === 'Ouro') return 'text-yellow-500';
    if (faixaAtual?.nome === 'Prata') return 'text-slate-400';
    if (faixaAtual?.nome === 'Bronze') return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="rounded-lg border bg-gradient-to-r from-muted/50 to-muted p-3 space-y-3">
      {/* Header com faixa atual */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className={`h-5 w-5 ${getIconColor()}`} />
          <span className="text-sm font-medium">Desconto Revendedor</span>
        </div>
        {faixaAtual ? (
          <Badge 
            className={`${faixaAtual.cor} text-white border-0`}
          >
            {faixaAtual.nome} - {faixaAtual.desconto}% OFF
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Sem desconto
          </Badge>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <Progress value={progresso} className="h-2" />
        
        {/* Marcadores das faixas */}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>R$ 0</span>
          <span className={valorTotal >= 299.90 ? 'text-amber-600 font-medium' : ''}>
            Bronze (R$299)
          </span>
          <span className={valorTotal >= 499.90 ? 'text-slate-500 font-medium' : ''}>
            Prata (R$499)
          </span>
          <span className={valorTotal >= 699.90 ? 'text-yellow-600 font-medium' : ''}>
            Ouro (R$699)
          </span>
        </div>
      </div>

      {/* Info sobre próxima faixa */}
      {proximaFaixa && (
        <div className="flex items-center gap-2 pt-1 text-xs">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">
            Faltam <strong className="text-foreground">R$ {proximaFaixa.falta.toFixed(2)}</strong> para{' '}
            <span className={proximaFaixa.faixa.nome === 'Ouro' ? 'text-yellow-600 font-medium' : 
                            proximaFaixa.faixa.nome === 'Prata' ? 'text-slate-500 font-medium' : 
                            'text-amber-600 font-medium'}>
              {proximaFaixa.faixa.nome} ({proximaFaixa.faixa.desconto}% OFF)
            </span>
          </span>
        </div>
      )}

      {/* Mensagem quando está na faixa máxima */}
      {!proximaFaixa && faixaAtual && (
        <div className="flex items-center gap-2 pt-1 text-xs text-yellow-600">
          <Target className="h-3.5 w-3.5" />
          <span className="font-medium">Parabéns! Você está na faixa máxima de desconto!</span>
        </div>
      )}

      {/* Valor do desconto aplicado */}
      {faixaAtual && (
        <div className="flex justify-between items-center pt-2 border-t text-sm">
          <span className="text-muted-foreground">Desconto aplicado:</span>
          <span className="font-semibold text-green-600">
            - R$ {(valorTotal * (faixaAtual.desconto / 100)).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}