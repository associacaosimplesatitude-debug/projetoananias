import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  Church,
  Package,
  Store,
  Briefcase,
  Building2,
  UserCheck,
  FileText,
  Percent,
  Clock,
  CalendarIcon,
} from "lucide-react";
import {
  subDays,
  parseISO,
  isWithinInterval,
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type DateFilter = "all" | "today" | "last_7_days" | "last_month" | "custom";

interface MarketplacePedido {
  id: string;
  marketplace: string;
  order_date: string | null;
  valor_total: number;
  created_at: string;
}

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
  marketplacePedidos?: MarketplacePedido[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface StandardCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  periodLabel: string;
  colorClass: string;
  borderColorClass: string;
  bgClass: string;
}

function StandardCard({
  icon,
  title,
  value,
  periodLabel,
  colorClass,
  borderColorClass,
  bgClass,
}: StandardCardProps) {
  return (
    <div
      className={`p-3 sm:p-4 rounded-xl border-2 ${borderColorClass} ${bgClass} flex flex-col h-full min-h-[100px] sm:min-h-[120px] overflow-hidden`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 min-w-0">
        <span className="flex-shrink-0">{icon}</span>
        <span className={`text-[10px] sm:text-xs font-medium ${colorClass} truncate`}>{title}</span>
      </div>
      <p className={`text-base sm:text-xl font-bold ${colorClass} mb-auto truncate`}>{value}</p>
      <p className={`text-[10px] sm:text-xs ${colorClass} opacity-70 mt-1 truncate`}>{periodLabel}</p>
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
  marketplacePedidos = [],
}: SalesChannelCardsProps) {
  // Estado local para filtro interno do card (mesma lógica das páginas de marketplace)
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const cardDateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today": {
        const start = startOfDay(now);
        const end = endOfDay(now);
        return { start, end, endInclusive: end };
      }
      case "last_7_days": {
        const start = subDays(now, 7);
        return { start, end: now, endInclusive: now };
      }
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        return { start, end, endInclusive: end };
      }
      case "custom": {
        if (!customDateRange.from) {
          return { start: new Date(0), end: now, endInclusive: now };
        }
        const start = customDateRange.from;
        const end = customDateRange.to || customDateRange.from;
        const endInclusive = new Date(end.getTime() + 86400000 - 1);
        return { start, end, endInclusive };
      }
      default:
        return { start: new Date(0), end: now, endInclusive: now };
    }
  }, [dateFilter, customDateRange]);

  const periodLabel = useMemo(() => {
    switch (dateFilter) {
      case "all":
        return "Todos";
      case "today":
        return "Hoje";
      case "last_7_days":
        return "Últimos 7 dias";
      case "last_month":
        return "Mês anterior";
      case "custom":
        if (customDateRange.from) {
          const from = format(customDateRange.from, "dd/MM");
          const to = customDateRange.to ? format(customDateRange.to, "dd/MM") : from;
          return `${from}${to ? ` - ${to}` : ""}`;
        }
        return "Personalizado";
      default:
        return "Todos";
    }
  }, [dateFilter, customDateRange]);

  const periodMetrics = useMemo(() => {
    const { start, endInclusive } = cardDateRange;

    const filterByRange = (orders: any[]) =>
      orders.filter((o) => {
        const dateField = o.order_date || o.created_at;
        if (!dateField) return false;
        const orderDate = parseISO(dateField);
        return isWithinInterval(orderDate, { start, end: endInclusive });
      });

    const paidShopifyOrders = shopifyOrders.filter(
      (o) => o.status_pagamento === "Pago" || o.status_pagamento === "paid" || o.status_pagamento === "Faturado"
    );
    const paidShopifyCGOrders = shopifyCGOrders.filter(
      (o) => o.status_pagamento === "paid" || o.status_pagamento === "Pago" || o.status_pagamento === "Faturado"
    );

    const igrejasFiltered = filterByRange(paidShopifyOrders);
    const valorIgrejas = igrejasFiltered.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    const onlineFiltered = filterByRange(paidShopifyCGOrders);
    const valorOnline = onlineFiltered.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    // Filtrar pedidos de marketplace pelo período (mesma lógica)
    const filterMarketplaceByRange = (orders: MarketplacePedido[]) =>
      orders.filter((p) => {
        if (!p.order_date) return false;
        const d = new Date(p.order_date);
        if (Number.isNaN(d.getTime())) return false;
        return isWithinInterval(d, { start, end: endInclusive });
      });

    const marketplaceFiltered = filterMarketplaceByRange(marketplacePedidos);
    const valorMarketplace = marketplaceFiltered.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    // Total Geral = Igrejas + Online + Marketplaces (Amazon, Shopee, ML, etc.)
    const valorTotal = valorIgrejas + valorOnline + valorMarketplace;
    const qtdTotal = igrejasFiltered.length + onlineFiltered.length + marketplaceFiltered.length;

    const comissao = vendedorStats.reduce((sum, v) => {
      const vendedorOrders = filterByRange(shopifyOrders.filter((o) => o.vendedor_id === v.id));
      const valorVendedor = vendedorOrders.reduce(
        (s, o) => s + Number(o.valor_para_meta || o.valor_total || 0),
        0
      );
      return sum + valorVendedor * (v.comissao_percentual / 100);
    }, 0);

    return {
      qtdOnline: onlineFiltered.length,
      valorOnline,
      qtdIgrejas: igrejasFiltered.length,
      valorIgrejas,
      valorTotal,
      qtdTotal,
      comissao,
    };
  }, [shopifyOrders, shopifyCGOrders, vendedorStats, cardDateRange, marketplacePedidos]);

  // Marketplace: replicar exatamente a lógica das páginas (p.order_date + date-fns)
  const marketplaceData = useMemo(() => {
    const now = new Date();

    const filterMarketplaceByPeriod = (orders: MarketplacePedido[]) => {
      switch (dateFilter) {
        case "today": {
          const todayStart = startOfDay(now);
          const todayEnd = endOfDay(now);
          return orders.filter((p) => {
            if (!p.order_date) return false;
            const d = new Date(p.order_date);
            return !Number.isNaN(d.getTime()) && isWithinInterval(d, { start: todayStart, end: todayEnd });
          });
        }
        case "last_7_days": {
          const sevenDaysAgo = subDays(now, 7);
          return orders.filter((p) => {
            if (!p.order_date) return false;
            const d = new Date(p.order_date);
            return !Number.isNaN(d.getTime()) && d >= sevenDaysAgo;
          });
        }
        case "last_month": {
          const lastMonth = subMonths(now, 1);
          const start = startOfMonth(lastMonth);
          const end = endOfMonth(lastMonth);
          return orders.filter((p) => {
            if (!p.order_date) return false;
            const d = new Date(p.order_date);
            return !Number.isNaN(d.getTime()) && isWithinInterval(d, { start, end });
          });
        }
        case "custom": {
          if (!customDateRange.from) return orders;
          const start = customDateRange.from;
          const end = customDateRange.to || customDateRange.from;
          return orders.filter((p) => {
            if (!p.order_date) return false;
            const d = new Date(p.order_date);
            if (Number.isNaN(d.getTime())) return false;
            return isWithinInterval(d, { start, end: new Date(end.getTime() + 86400000 - 1) });
          });
        }
        default:
          return orders;
      }
    };

    const amazonOrders = filterMarketplaceByPeriod(
      marketplacePedidos.filter((p) => p.marketplace === "AMAZON")
    );
    const shopeeOrders = filterMarketplaceByPeriod(
      marketplacePedidos.filter((p) => p.marketplace === "SHOPEE")
    );
    const mlOrders = filterMarketplaceByPeriod(
      marketplacePedidos.filter((p) => p.marketplace === "MERCADO_LIVRE")
    );
    const advecsOrders = filterMarketplaceByPeriod(
      marketplacePedidos.filter((p) => p.marketplace === "ADVECS")
    );
    const atacadoOrders = filterMarketplaceByPeriod(
      marketplacePedidos.filter((p) => p.marketplace === "ATACADO")
    );

    return {
      amazon: { valor: amazonOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: amazonOrders.length },
      shopee: { valor: shopeeOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: shopeeOrders.length },
      mercadoLivre: { valor: mlOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: mlOrders.length },
      advecs: { valor: advecsOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: advecsOrders.length },
      revendedores: { valor: 0, qtd: 0 },
      atacado: { valor: atacadoOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: atacadoOrders.length },
      representantes: { valor: 0, qtd: 0 },
    };
  }, [marketplacePedidos, dateFilter, customDateRange]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Resumo de Vendas
              </CardTitle>
              <CardDescription>Métricas consolidadas de todos os canais de venda</CardDescription>
            </div>
          </div>
          
          {/* Botões de filtro de período (igual às páginas de marketplace) */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "all", label: "Todos" },
              { value: "today", label: "Hoje" },
              { value: "last_7_days", label: "7 dias" },
              { value: "last_month", label: "Mês anterior" },
            ].map((btn) => (
              <Button
                key={btn.value}
                variant={dateFilter === btn.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(btn.value as DateFilter)}
              >
                {btn.label}
              </Button>
            ))}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant={dateFilter === "custom" ? "default" : "outline"} size="sm" className="gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  Período
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => {
                    setCustomDateRange({ from: range?.from, to: range?.to });
                    if (range?.from) setDateFilter("custom");
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <span className="text-xs text-muted-foreground ml-auto">{periodLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StandardCard
            icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
            title="Pedidos Online"
            value={formatCurrency(periodMetrics.valorOnline)}
            periodLabel={`${periodMetrics.qtdOnline} pedidos`}
            colorClass="text-blue-700 dark:text-blue-300"
            borderColorClass="border-blue-200 dark:border-blue-800"
            bgClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />

          <StandardCard
            icon={<Church className="h-4 w-4 text-green-600" />}
            title="Pedidos Igrejas"
            value={formatCurrency(periodMetrics.valorIgrejas)}
            periodLabel={`${periodMetrics.qtdIgrejas} pedidos`}
            colorClass="text-green-700 dark:text-green-300"
            borderColorClass="border-green-200 dark:border-green-800"
            bgClass="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
          />

          <StandardCard
            icon={<Package className="h-4 w-4 text-orange-600" />}
            title="Amazon"
            value={formatCurrency(marketplaceData.amazon.valor)}
            periodLabel={`${marketplaceData.amazon.qtd} pedidos`}
            colorClass="text-orange-700 dark:text-orange-300"
            borderColorClass="border-orange-200 dark:border-orange-800"
            bgClass="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
          />

          <StandardCard
            icon={<Store className="h-4 w-4 text-red-600" />}
            title="Shopee"
            value={formatCurrency(marketplaceData.shopee.valor)}
            periodLabel={`${marketplaceData.shopee.qtd} pedidos`}
            colorClass="text-red-700 dark:text-red-300"
            borderColorClass="border-red-200 dark:border-red-800"
            bgClass="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"
          />

          <StandardCard
            icon={<ShoppingCart className="h-4 w-4 text-yellow-600" />}
            title="Mercado Livre"
            value={formatCurrency(marketplaceData.mercadoLivre.valor)}
            periodLabel={`${marketplaceData.mercadoLivre.qtd} pedidos`}
            colorClass="text-yellow-700 dark:text-yellow-300"
            borderColorClass="border-yellow-200 dark:border-yellow-800"
            bgClass="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900"
          />

          <StandardCard
            icon={<Building2 className="h-4 w-4 text-teal-600" />}
            title="ADVECS"
            value={formatCurrency(marketplaceData.advecs.valor)}
            periodLabel={`${marketplaceData.advecs.qtd} pedidos`}
            colorClass="text-teal-700 dark:text-teal-300"
            borderColorClass="border-teal-200 dark:border-teal-800"
            bgClass="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900"
          />

          <StandardCard
            icon={<UserCheck className="h-4 w-4 text-violet-600" />}
            title="Revendedores"
            value={formatCurrency(marketplaceData.revendedores.valor)}
            periodLabel={`${marketplaceData.revendedores.qtd} pedidos`}
            colorClass="text-violet-700 dark:text-violet-300"
            borderColorClass="border-violet-200 dark:border-violet-800"
            bgClass="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
          />

          <StandardCard
            icon={<Briefcase className="h-4 w-4 text-sky-600" />}
            title="Atacado"
            value={formatCurrency(marketplaceData.atacado.valor)}
            periodLabel={`${marketplaceData.atacado.qtd} pedidos`}
            colorClass="text-sky-700 dark:text-sky-300"
            borderColorClass="border-sky-200 dark:border-sky-800"
            bgClass="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900"
          />

          <StandardCard
            icon={<Users className="h-4 w-4 text-rose-600" />}
            title="Representantes"
            value={formatCurrency(marketplaceData.representantes.valor)}
            periodLabel={`${marketplaceData.representantes.qtd} pedidos`}
            colorClass="text-rose-700 dark:text-rose-300"
            borderColorClass="border-rose-200 dark:border-rose-800"
            bgClass="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900"
          />

          <StandardCard
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            title="TOTAL GERAL"
            value={formatCurrency(periodMetrics.valorTotal)}
            periodLabel={`${periodMetrics.qtdTotal} pedidos • ${periodLabel}`}
            colorClass="text-emerald-700 dark:text-emerald-300"
            borderColorClass="border-emerald-300 dark:border-emerald-700"
            bgClass="bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-950 dark:to-emerald-900"
          />
        </div>

      </CardContent>
    </Card>
  );
}
