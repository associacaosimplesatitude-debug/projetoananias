import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, Clock, Calendar, AlertTriangle, CheckCircle2, 
  TrendingUp, Wallet, ChevronRight
} from "lucide-react";

interface ComissaoKPIs {
  aPagar: { valor: number; quantidade: number };
  agendadas: { valor: number; quantidade: number };
  pendentes: { valor: number; quantidade: number };
  pagas: { valor: number; quantidade: number };
  atrasadas: { valor: number; quantidade: number };
}

interface ComissaoKPICardsProps {
  kpis: ComissaoKPIs;
  onViewDetail?: (status: string) => void;
}

export function ComissaoKPICards({ kpis, onViewDetail }: ComissaoKPICardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {/* A Pagar Agora */}
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-700">A Pagar Agora</CardTitle>
          <Wallet className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700">
            R$ {kpis.aPagar.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-green-600">{kpis.aPagar.quantidade} comissões liberadas</p>
          {onViewDetail && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-100 disabled:opacity-50"
              onClick={() => onViewDetail('liberada')}
              disabled={kpis.aPagar.quantidade === 0}
            >
              Ver comissões
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Agendadas (Dia 05) */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-700">Agendadas (Dia 05)</CardTitle>
          <Calendar className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">
            R$ {kpis.agendadas.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-blue-600">{kpis.agendadas.quantidade} vendas online</p>
          {onViewDetail && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-7 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              onClick={() => onViewDetail('agendada')}
              disabled={kpis.agendadas.quantidade === 0}
            >
              Ver comissões
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pendentes (30/60/90) */}
      <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-yellow-700">Pendentes Futuras</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-700">
            R$ {kpis.pendentes.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-yellow-600">{kpis.pendentes.quantidade} parcelas 30/60/90</p>
          {onViewDetail && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-7 px-2 text-xs text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
              onClick={() => onViewDetail('pendente')}
              disabled={kpis.pendentes.quantidade === 0}
            >
              Ver comissões
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pagas no Mês */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pagas no Mês</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            R$ {kpis.pagas.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">{kpis.pagas.quantidade} comissões pagas</p>
          {onViewDetail && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-7 px-2 text-xs disabled:opacity-50"
              onClick={() => onViewDetail('paga')}
              disabled={kpis.pagas.quantidade === 0}
            >
              Ver comissões
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Atrasadas */}
      <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-700">Atrasadas</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-700">
            R$ {kpis.atrasadas.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-red-600">{kpis.atrasadas.quantidade} requerem atenção</p>
          {onViewDetail && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-7 px-2 text-xs text-red-700 hover:text-red-800 hover:bg-red-100 disabled:opacity-50"
              onClick={() => onViewDetail('atrasada')}
              disabled={kpis.atrasadas.quantidade === 0}
            >
              Ver comissões
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
