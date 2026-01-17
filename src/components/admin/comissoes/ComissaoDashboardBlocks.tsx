import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, Wallet, FileText, TrendingUp } from "lucide-react";

interface DashboardBlocksProps {
  pagamentoDia05: {
    agendado: number;
    liberado: number;
    quantidadeAgendada: number;
    quantidadeLiberada: number;
  };
  recebimentos: {
    pendente: number;
    liberadoHoje: number;
    atrasado: number;
    quantidadePendente: number;
    quantidadeLiberadoHoje: number;
    quantidadeAtrasado: number;
  };
  onGerarLote: () => void;
  isGenerating?: boolean;
}

export function ComissaoDashboardBlocks({ 
  pagamentoDia05, 
  recebimentos, 
  onGerarLote,
  isGenerating 
}: DashboardBlocksProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Bloco Pagamento Dia 05 */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10">
        <CardHeader className="border-b border-blue-100">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Calendar className="h-5 w-5" />
            Pagamento Dia 05
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/60 dark:bg-background/60">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Agendado no Mês
              </div>
              <p className="text-xl font-bold text-blue-700">
                R$ {pagamentoDia05.agendado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600">{pagamentoDia05.quantidadeAgendada} vendas online</p>
            </div>
            <div className="p-3 rounded-lg bg-white/60 dark:bg-background/60">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wallet className="h-4 w-4" />
                Liberado para Pagamento
              </div>
              <p className="text-xl font-bold text-green-700">
                R$ {pagamentoDia05.liberado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">{pagamentoDia05.quantidadeLiberada} comissões</p>
            </div>
          </div>
          
          <Button 
            onClick={onGerarLote} 
            className="w-full"
            disabled={isGenerating || pagamentoDia05.quantidadeLiberada === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            Gerar Lote de Pagamento
          </Button>
        </CardContent>
      </Card>

      {/* Bloco Comissões por Recebimento (30/60/90) */}
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/10 dark:to-yellow-950/10">
        <CardHeader className="border-b border-amber-100">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <TrendingUp className="h-5 w-5" />
            Comissões por Recebimento (30/60/90)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white/60 dark:bg-background/60 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                Pendente
              </div>
              <p className="text-lg font-bold text-yellow-700">
                R$ {recebimentos.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-yellow-600">{recebimentos.quantidadePendente}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/60 dark:bg-background/60 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <Wallet className="h-3 w-3" />
                Liberado Hoje
              </div>
              <p className="text-lg font-bold text-green-700">
                R$ {recebimentos.liberadoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">{recebimentos.quantidadeLiberadoHoje}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/60 dark:bg-background/60 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <AlertTriangle className="h-3 w-3" />
                Atrasado
              </div>
              <p className="text-lg font-bold text-red-700">
                R$ {recebimentos.atrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-red-600">{recebimentos.quantidadeAtrasado}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
