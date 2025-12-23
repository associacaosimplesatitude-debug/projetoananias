import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
  Clock,
  Users,
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

// Componente de Card padronizado
interface StandardCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  todayLabel: string;
  sevenDayLabel: string;
  colorClass: string;
  borderColorClass: string;
  bgClass: string;
}

function StandardCard({ icon, title, value, todayLabel, sevenDayLabel, colorClass, borderColorClass, bgClass }: StandardCardProps) {
  return (
    <div className={`p-4 rounded-xl border-2 ${borderColorClass} ${bgClass} flex flex-col h-full min-h-[140px]`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={`text-xs font-medium ${colorClass}`}>{title}</span>
      </div>
      <p className={`text-xl font-bold ${colorClass} mb-auto`}>{value}</p>
      <div className={`text-xs ${colorClass} opacity-80 mt-2 pt-2 border-t border-current/20`}>
        <div className="flex justify-between">
          <span>Hoje: {todayLabel}</span>
          <span>7d: {sevenDayLabel}</span>
        </div>
      </div>
    </div>
  );
}

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
        {/* Grid unificado de todos os canais de venda */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Pedidos Online */}
          <StandardCard
            icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
            title="Pedidos Online"
            value={formatCurrency(dailyMetrics.valorOnlineToday)}
            todayLabel={`${dailyMetrics.onlineToday}`}
            sevenDayLabel={`${dailyMetrics.online7Days}`}
            colorClass="text-blue-700 dark:text-blue-300"
            borderColorClass="border-blue-200 dark:border-blue-800"
            bgClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />

          {/* Pedidos Igrejas */}
          <StandardCard
            icon={<Church className="h-4 w-4 text-green-600" />}
            title="Pedidos Igrejas"
            value={formatCurrency(dailyMetrics.valorIgrejasToday)}
            todayLabel={`${dailyMetrics.igrejasToday}`}
            sevenDayLabel={`${dailyMetrics.igrejas7Days}`}
            colorClass="text-green-700 dark:text-green-300"
            borderColorClass="border-green-200 dark:border-green-800"
            bgClass="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
          />

          {/* Amazon */}
          <StandardCard
            icon={<Package className="h-4 w-4 text-orange-600" />}
            title="Amazon"
            value={formatCurrency(marketplaceData.amazon.valorDia)}
            todayLabel={`${marketplaceData.amazon.vendasDia}`}
            sevenDayLabel={`${marketplaceData.amazon.vendas7Dias}`}
            colorClass="text-orange-700 dark:text-orange-300"
            borderColorClass="border-orange-200 dark:border-orange-800"
            bgClass="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
          />

          {/* Shopee */}
          <StandardCard
            icon={<Store className="h-4 w-4 text-red-600" />}
            title="Shopee"
            value={formatCurrency(marketplaceData.shopee.valorDia)}
            todayLabel={`${marketplaceData.shopee.vendasDia}`}
            sevenDayLabel={`${marketplaceData.shopee.vendas7Dias}`}
            colorClass="text-red-700 dark:text-red-300"
            borderColorClass="border-red-200 dark:border-red-800"
            bgClass="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"
          />

          {/* Mercado Livre */}
          <StandardCard
            icon={<ShoppingCart className="h-4 w-4 text-yellow-600" />}
            title="Mercado Livre"
            value={formatCurrency(marketplaceData.mercadoLivre.valorDia)}
            todayLabel={`${marketplaceData.mercadoLivre.vendasDia}`}
            sevenDayLabel={`${marketplaceData.mercadoLivre.vendas7Dias}`}
            colorClass="text-yellow-700 dark:text-yellow-300"
            borderColorClass="border-yellow-200 dark:border-yellow-800"
            bgClass="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900"
          />

          {/* ADVECS */}
          <StandardCard
            icon={<Building2 className="h-4 w-4 text-teal-600" />}
            title="ADVECS"
            value={formatCurrency(marketplaceData.advecs.valorDia)}
            todayLabel={`${marketplaceData.advecs.vendasDia}`}
            sevenDayLabel={`${marketplaceData.advecs.vendas7Dias}`}
            colorClass="text-teal-700 dark:text-teal-300"
            borderColorClass="border-teal-200 dark:border-teal-800"
            bgClass="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900"
          />

          {/* Revendedores */}
          <StandardCard
            icon={<UserCheck className="h-4 w-4 text-violet-600" />}
            title="Revendedores"
            value={formatCurrency(marketplaceData.revendedores.valorDia)}
            todayLabel={`${marketplaceData.revendedores.vendasDia}`}
            sevenDayLabel={`${marketplaceData.revendedores.vendas7Dias}`}
            colorClass="text-violet-700 dark:text-violet-300"
            borderColorClass="border-violet-200 dark:border-violet-800"
            bgClass="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
          />

          {/* Atacado */}
          <StandardCard
            icon={<Briefcase className="h-4 w-4 text-sky-600" />}
            title="Atacado"
            value={formatCurrency(marketplaceData.atacado.valorDia)}
            todayLabel={`${marketplaceData.atacado.vendasDia}`}
            sevenDayLabel={`${marketplaceData.atacado.vendas7Dias}`}
            colorClass="text-sky-700 dark:text-sky-300"
            borderColorClass="border-sky-200 dark:border-sky-800"
            bgClass="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900"
          />

          {/* Representantes */}
          <StandardCard
            icon={<Users className="h-4 w-4 text-rose-600" />}
            title="Representantes"
            value={formatCurrency(marketplaceData.representantes.valorDia)}
            todayLabel={`${marketplaceData.representantes.vendasDia}`}
            sevenDayLabel={`${marketplaceData.representantes.vendas7Dias}`}
            colorClass="text-rose-700 dark:text-rose-300"
            borderColorClass="border-rose-200 dark:border-rose-800"
            bgClass="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900"
          />

          {/* TOTAL GERAL */}
          <StandardCard
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            title="TOTAL GERAL"
            value={formatCurrency(dailyMetrics.valorTotalToday)}
            todayLabel={formatCurrency(dailyMetrics.valorTotalToday)}
            sevenDayLabel={formatCurrency(dailyMetrics.valorTotal7Days)}
            colorClass="text-emerald-700 dark:text-emerald-300"
            borderColorClass="border-emerald-300 dark:border-emerald-700"
            bgClass="bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-950 dark:to-emerald-900"
          />
        </div>

        {/* Cards de Gestão */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Propostas Abertas */}
          <div className="p-4 rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Propostas Abertas</span>
            </div>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{propostasDigitaisAbertas}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">propostas digitais pendentes</p>
          </div>

          {/* Pedidos Bling Pendentes */}
          <div className="p-4 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Pedidos Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{pedidosBlingPendentes}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">aguardando envio ao Bling</p>
          </div>

          {/* Custo de Comissão */}
          <div className="p-4 rounded-xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 dark:border-pink-800">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-pink-600" />
              <span className="text-xs font-medium text-pink-700 dark:text-pink-300">Custo de Comissão</span>
            </div>
            <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">{formatCurrency(dailyMetrics.comissaoToday)}</p>
            <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">7 dias: {formatCurrency(dailyMetrics.comissao7Days)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
