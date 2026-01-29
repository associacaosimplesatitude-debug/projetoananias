import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, BookOpen, TrendingUp } from "lucide-react";

interface VendasSummaryCardsProps {
  vendas: Array<{
    quantidade: number;
    valor_unitario: number;
    valor_comissao_total: number;
    pagamento_id: string | null;
  }>;
}

export function VendasSummaryCards({ vendas }: VendasSummaryCardsProps) {
  const totalVendas = vendas.reduce(
    (acc, v) => acc + (v.valor_unitario * v.quantidade),
    0
  );
  
  const totalQuantidade = vendas.reduce(
    (acc, v) => acc + v.quantidade,
    0
  );
  
  const totalRoyaltiesPendentes = vendas
    .filter(v => !v.pagamento_id)
    .reduce((acc, v) => acc + v.valor_comissao_total, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total em Vendas</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalVendas)}</div>
          <p className="text-xs text-muted-foreground">
            Valor total das vendas registradas
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Livros Vendidos</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalQuantidade}</div>
          <p className="text-xs text-muted-foreground">
            Quantidade total de unidades
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Royalties Pendentes</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(totalRoyaltiesPendentes)}
          </div>
          <p className="text-xs text-muted-foreground">
            Comissões ainda não pagas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
