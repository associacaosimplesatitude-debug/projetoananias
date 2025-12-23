import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
  Clock,
  Truck,
  Trophy,
  Users,
  GraduationCap,
  BookOpen,
  Church,
  Package,
  Store,
  Briefcase,
  Building2,
  UserCheck,
  FileText,
  Percent,
} from "lucide-react";
import { startOfDay, subDays, parseISO, isWithinInterval, endOfDay } from "date-fns";

interface SalesChannelCardsProps {
  dashboardKPIs: {
    totalPedidosOnline: number;
    valorPedidosOnline: number;
    pedidosOnlinePagos: number;
    totalPedidosIgrejas: number;
    valorPedidosIgrejas: number;
    pedidosIgrejasPagos: number;
    propostasPendentes: number;
    pedidosFaturados: number;
    valorFaturados: number;
    totalPedidosPagos: number;
    valorTotalPago: number;
    recorrentesIgrejas: number;
    recorrentesCG: number;
    totalRecorrentes: number;
  };
  totalEbdClients: number;
  totalAlunos: number | undefined;
  totalTurmas: number | undefined;
  shopifyOrders: any[];
  shopifyCGOrders: any[];
  vendedorStats: any[];
  propostasDigitaisAbertas: number;
  pedidosBlingPendentes: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function SalesChannelCards({
  dashboardKPIs,
  totalEbdClients,
  totalAlunos,
  totalTurmas,
  shopifyOrders,
  shopifyCGOrders,
  vendedorStats,
  propostasDigitaisAbertas,
  pedidosBlingPendentes,
}: SalesChannelCardsProps) {
  
  // Calculate daily and 7-day metrics
  const dailyMetrics = useMemo(() => {
    const today = startOfDay(new Date());
    const endToday = endOfDay(new Date());
    const sevenDaysAgo = startOfDay(subDays(new Date(), 7));

    // Helper to filter orders by date range
    const filterByRange = (orders: any[], start: Date, end: Date) => {
      return orders.filter(o => {
        if (!o.created_at) return false;
        const orderDate = parseISO(o.created_at);
        return isWithinInterval(orderDate, { start, end });
      });
    };

    // Get paid orders only
    const paidShopifyOrders = shopifyOrders.filter(o => 
      o.status_pagamento === 'Pago' || o.status_pagamento === 'paid' || o.status_pagamento === 'Faturado'
    );
    const paidShopifyCGOrders = shopifyCGOrders.filter(o => 
      o.status_pagamento === 'paid' || o.status_pagamento === 'Pago' || o.status_pagamento === 'Faturado'
    );

    // Pedidos Igrejas (Shopify principal)
    const igrejasToday = filterByRange(paidShopifyOrders, today, endToday);
    const igrejas7Days = filterByRange(paidShopifyOrders, sevenDaysAgo, endToday);
    const valorIgrejasToday = igrejasToday.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    const valorIgrejas7Days = igrejas7Days.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    // Pedidos Online (CG)
    const onlineToday = filterByRange(paidShopifyCGOrders, today, endToday);
    const online7Days = filterByRange(paidShopifyCGOrders, sevenDaysAgo, endToday);
    const valorOnlineToday = onlineToday.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    const valorOnline7Days = online7Days.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    // Total
    const valorTotalToday = valorIgrejasToday + valorOnlineToday;
    const valorTotal7Days = valorIgrejas7Days + valorOnline7Days;
    const vendasToday = igrejasToday.length + onlineToday.length;
    const vendas7Days = igrejas7Days.length + online7Days.length;

    // Commission calculations (daily and 7-day)
    const comissaoToday = vendedorStats.reduce((sum, v) => {
      const ordersToday = filterByRange(
        shopifyOrders.filter(o => o.vendedor_id === v.id),
        today,
        endToday
      );
      const valorToday = ordersToday.reduce((s, o) => s + Number(o.valor_para_meta || o.valor_total || 0), 0);
      return sum + valorToday * (v.comissao_percentual / 100);
    }, 0);

    const comissao7Days = vendedorStats.reduce((sum, v) => {
      const orders7d = filterByRange(
        shopifyOrders.filter(o => o.vendedor_id === v.id),
        sevenDaysAgo,
        endToday
      );
      const valor7d = orders7d.reduce((s, o) => s + Number(o.valor_para_meta || o.valor_total || 0), 0);
      return sum + valor7d * (v.comissao_percentual / 100);
    }, 0);

    return {
      // Pedidos Online
      onlineToday: onlineToday.length,
      online7Days: online7Days.length,
      valorOnlineToday,
      valorOnline7Days,
      // Pedidos Igrejas
      igrejasToday: igrejasToday.length,
      igrejas7Days: igrejas7Days.length,
      valorIgrejasToday,
      valorIgrejas7Days,
      // Total
      valorTotalToday,
      valorTotal7Days,
      vendasToday,
      vendas7Days,
      // Comissão
      comissaoToday,
      comissao7Days,
    };
  }, [shopifyOrders, shopifyCGOrders, vendedorStats]);

  // Placeholder data for future marketplace integrations
  const marketplaceData = {
    amazon: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
    shopee: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
    mercadoLivre: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
    advecs: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
    revendedores: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
    atacado: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
    representantes: { valorDia: 0, vendasDia: 0, vendas7Dias: 0 },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Resumo de Vendas
        </CardTitle>
        <CardDescription>Métricas consolidadas de todos os canais de venda</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primeira linha - Cards principais existentes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Pedidos Online (CG) */}
          <div className="p-5 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Pedidos Online</span>
              </div>
              <Badge variant="secondary" className="bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                {dashboardKPIs.totalPedidosOnline} pedidos
              </Badge>
            </div>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(dashboardKPIs.valorPedidosOnline)}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {dashboardKPIs.pedidosOnlinePagos} pagos • {dashboardKPIs.recorrentesCG} recorrentes
            </p>
            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-blue-600 dark:text-blue-400">Hoje:</span>
                <span className="ml-1 font-medium">{dailyMetrics.onlineToday} vendas</span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400">7 dias:</span>
                <span className="ml-1 font-medium">{dailyMetrics.online7Days} vendas</span>
              </div>
            </div>
          </div>

          {/* Pedidos Igrejas */}
          <div className="p-5 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 dark:border-green-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Church className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Pedidos Igrejas</span>
              </div>
              <Badge variant="secondary" className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200">
                {dashboardKPIs.totalPedidosIgrejas} pedidos
              </Badge>
            </div>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100">
              {formatCurrency(dashboardKPIs.valorPedidosIgrejas)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {dashboardKPIs.pedidosIgrejasPagos} pagos • {dashboardKPIs.recorrentesIgrejas} recorrentes
            </p>
            <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-green-600 dark:text-green-400">Hoje:</span>
                <span className="ml-1 font-medium">{dailyMetrics.igrejasToday} vendas</span>
              </div>
              <div>
                <span className="text-green-600 dark:text-green-400">7 dias:</span>
                <span className="ml-1 font-medium">{dailyMetrics.igrejas7Days} vendas</span>
              </div>
            </div>
          </div>

          {/* Total Consolidado */}
          <div className="p-5 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-950 dark:to-emerald-900 dark:border-emerald-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-700" />
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">TOTAL VENDAS</span>
              </div>
              <Badge variant="secondary" className="bg-emerald-300 text-emerald-900 dark:bg-emerald-700 dark:text-emerald-100">
                {dashboardKPIs.totalPedidosPagos} pedidos
              </Badge>
            </div>
            <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-100">
              {formatCurrency(dashboardKPIs.valorTotalPago)}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              {dashboardKPIs.totalRecorrentes} clientes recorrentes
            </p>
            <div className="mt-2 pt-2 border-t border-emerald-300 dark:border-emerald-600 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-emerald-700 dark:text-emerald-300">Hoje:</span>
                <span className="ml-1 font-medium">{formatCurrency(dailyMetrics.valorTotalToday)}</span>
              </div>
              <div>
                <span className="text-emerald-700 dark:text-emerald-300">7 dias:</span>
                <span className="ml-1 font-medium">{formatCurrency(dailyMetrics.valorTotal7Days)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Canais de Venda - Marketplaces */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Amazon */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Amazon</span>
            </div>
            <p className="text-lg font-bold text-orange-900 dark:text-orange-100">{formatCurrency(marketplaceData.amazon.valorDia)}</p>
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              <span>{marketplaceData.amazon.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.amazon.vendas7Dias} 7d</span>
            </div>
          </div>

          {/* Shopee */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300">Shopee</span>
            </div>
            <p className="text-lg font-bold text-red-900 dark:text-red-100">{formatCurrency(marketplaceData.shopee.valorDia)}</p>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              <span>{marketplaceData.shopee.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.shopee.vendas7Dias} 7d</span>
            </div>
          </div>

          {/* Mercado Livre */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Mercado Livre</span>
            </div>
            <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{formatCurrency(marketplaceData.mercadoLivre.valorDia)}</p>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              <span>{marketplaceData.mercadoLivre.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.mercadoLivre.vendas7Dias} 7d</span>
            </div>
          </div>

          {/* ADVECS */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-medium text-teal-700 dark:text-teal-300">ADVECS</span>
            </div>
            <p className="text-lg font-bold text-teal-900 dark:text-teal-100">{formatCurrency(marketplaceData.advecs.valorDia)}</p>
            <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">
              <span>{marketplaceData.advecs.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.advecs.vendas7Dias} 7d</span>
            </div>
          </div>

          {/* Revendedores */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Revendedores</span>
            </div>
            <p className="text-lg font-bold text-violet-900 dark:text-violet-100">{formatCurrency(marketplaceData.revendedores.valorDia)}</p>
            <div className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              <span>{marketplaceData.revendedores.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.revendedores.vendas7Dias} 7d</span>
            </div>
          </div>

          {/* Atacado */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Atacado</span>
            </div>
            <p className="text-lg font-bold text-sky-900 dark:text-sky-100">{formatCurrency(marketplaceData.atacado.valorDia)}</p>
            <div className="text-xs text-sky-600 dark:text-sky-400 mt-1">
              <span>{marketplaceData.atacado.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.atacado.vendas7Dias} 7d</span>
            </div>
          </div>

          {/* Representantes */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-rose-600" />
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Representantes</span>
            </div>
            <p className="text-lg font-bold text-rose-900 dark:text-rose-100">{formatCurrency(marketplaceData.representantes.valorDia)}</p>
            <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              <span>{marketplaceData.representantes.vendasDia} hoje</span>
              <span className="mx-1">•</span>
              <span>{marketplaceData.representantes.vendas7Dias} 7d</span>
            </div>
          </div>
        </div>

        {/* Card TOTAL GERAL do Dia */}
        <div className="p-4 rounded-xl border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/20 dark:to-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-primary" />
              <div>
                <span className="text-sm font-bold text-primary">TOTAL GERAL DO DIA</span>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(dailyMetrics.valorTotalToday)}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
              <p className="text-xl font-bold text-muted-foreground">{formatCurrency(dailyMetrics.valorTotal7Days)}</p>
            </div>
          </div>
        </div>

        {/* Cards de Status e Gestão */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Propostas Pendentes */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Propostas Abertas</span>
            </div>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{propostasDigitaisAbertas}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">propostas digitais</p>
          </div>

          {/* Pedidos Bling Pendentes */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Pendentes Bling</span>
            </div>
            <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100">{pedidosBlingPendentes}</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">pedidos pendentes</p>
          </div>

          {/* Custo de Comissão */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-lime-50 to-lime-100 dark:from-lime-950 dark:to-lime-900">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-4 w-4 text-lime-600" />
              <span className="text-xs font-medium text-lime-700 dark:text-lime-300">Comissão (Dia)</span>
            </div>
            <p className="text-xl font-bold text-lime-900 dark:text-lime-100">{formatCurrency(dailyMetrics.comissaoToday)}</p>
            <p className="text-xs text-lime-600 dark:text-lime-400">7d: {formatCurrency(dailyMetrics.comissao7Days)}</p>
          </div>

          {/* Pedidos Faturados */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Faturados</span>
            </div>
            <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{dashboardKPIs.pedidosFaturados}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {formatCurrency(dashboardKPIs.valorFaturados)}
            </p>
          </div>

          {/* Clientes EBD */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Clientes EBD</span>
            </div>
            <p className="text-xl font-bold text-indigo-900 dark:text-indigo-100">{totalEbdClients}</p>
          </div>

          {/* Total Alunos */}
          <div className="p-3 rounded-lg border bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-4 w-4 text-cyan-600" />
              <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">Alunos</span>
            </div>
            <p className="text-xl font-bold text-cyan-900 dark:text-cyan-100">{totalAlunos ?? 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
