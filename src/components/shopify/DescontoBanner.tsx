import { Badge } from "@/components/ui/badge";
import { Percent, Gift, Sparkles, UserCircle } from "lucide-react";
import { CalculoDesconto } from "@/lib/descontosShopify";

interface DescontoBannerProps {
  calculo: CalculoDesconto;
}

export function DescontoBanner({ calculo }: DescontoBannerProps) {
  if (calculo.tipoDesconto === "nenhum" || calculo.descontoPercentual === 0) {
    return null;
  }

  const getConfig = () => {
    switch (calculo.tipoDesconto) {
      case "advec_50":
        return {
          icon: <Gift className="h-4 w-4" />,
          bgClass: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800",
          textClass: "text-purple-700 dark:text-purple-400",
          badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
          titulo: "Desconto ADVEC",
          descricao: calculo.itensComDesconto50?.length 
            ? `50% de desconto em: ${calculo.itensComDesconto50.join(", ")}`
            : "50% de desconto em produtos selecionados"
        };
      case "setup":
        return {
          icon: <Sparkles className="h-4 w-4" />,
          bgClass: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
          textClass: "text-green-700 dark:text-green-400",
          badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          titulo: `Desconto Setup ${calculo.faixa}`,
          descricao: `${calculo.descontoPercentual}% de desconto por ter completado o Setup`
        };
      case "revendedor":
        return {
          icon: <Percent className="h-4 w-4" />,
          bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
          textClass: "text-amber-700 dark:text-amber-400",
          badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          titulo: `Desconto ${calculo.faixa}`,
          descricao: `${calculo.descontoPercentual}% de desconto para revendedores`
        };
      case "b2b":
        return {
          icon: <Percent className="h-4 w-4" />,
          bgClass: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
          textClass: "text-blue-700 dark:text-blue-400",
          badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          titulo: "Desconto B2B",
          descricao: `${calculo.descontoPercentual}% de desconto por faturamento`
        };
      case "vendedor":
        return {
          icon: <Percent className="h-4 w-4" />,
          bgClass: "bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800",
          textClass: "text-cyan-700 dark:text-cyan-400",
          badgeClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
          titulo: "Desconto do Vendedor",
          descricao: `${calculo.descontoPercentual}% de desconto especial`
        };
      case "representante":
        return {
          icon: <UserCircle className="h-4 w-4" />,
          bgClass: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
          textClass: "text-orange-700 dark:text-orange-400",
          badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
          titulo: "Desconto do Representante",
          descricao: `Desconto por categoria aplicado (~${calculo.descontoPercentual.toFixed(1)}% médio)`
        };
      default:
        return null;
    }
  };

  const config = getConfig();
  if (!config) return null;

  return (
    <div className={`p-3 rounded-lg border ${config.bgClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={config.textClass}>{config.icon}</div>
          <div>
            <p className={`text-sm font-medium ${config.textClass}`}>{config.titulo}</p>
            <p className="text-xs text-muted-foreground">{config.descricao}</p>
          </div>
        </div>
        <Badge className={config.badgeClass}>
          -R$ {calculo.descontoValor.toFixed(2)}
        </Badge>
      </div>
      
      {/* Detalhes por categoria para Representante */}
      {calculo.tipoDesconto === "representante" && calculo.itensComDescontoCategoria && calculo.itensComDescontoCategoria.length > 0 && (
        <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800 space-y-1.5">
          {calculo.itensComDescontoCategoria.filter(item => item.percentual > 0).map((item, index) => (
            <div key={index} className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground truncate max-w-[60%]">
                {item.titulo}
              </span>
              <span className={config.textClass}>
                {item.categoriaLabel} – {item.percentual}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
