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
  startOfDay,
  subDays,
  parseISO,
  isWithinInterval,
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

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

  // filtro global do painel (/admin/ebd)
  period: "all" | "today" | "7" | "thisMonth" | "lastMonth" | "custom";
  dateRange: { start: Date; end: Date };
  customStartDate?: string;
  customEndDate?: string;
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
      className={`p-4 rounded-xl border-2 ${borderColorClass} ${bgClass} flex flex-col h-full min-h-[120px]`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={`text-xs font-medium ${colorClass}`}>{title}</span>
      </div>
      <p className={`text-xl font-bold ${colorClass} mb-auto`}>{value}</p>
      <p className={`text-xs ${colorClass} opacity-70 mt-1`}>{periodLabel}</p>
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
  period: externalPeriod,
  dateRange: externalDateRange,
  customStartDate: externalCustomStart,
  customEndDate: externalCustomEnd,
}: SalesChannelCardsProps) {
  // Estado local para filtro interno do card
  const [localPeriod, setLocalPeriod] = useState<"all" | "today" | "7" | "thisMonth" | "lastMonth" | "custom">("7");
  const [localDateRange, setLocalDateRange] = useState<DateRange | undefined>(undefined);

  // Usar filtro local se definido, senão usar o externo
  const period = localPeriod;
  const customStartDate = localDateRange?.from ? format(localDateRange.from, "yyyy-MM-dd") : undefined;
  const customEndDate = localDateRange?.to ? format(localDateRange.to, "yyyy-MM-dd") : undefined;

  // Calcular dateRange baseado no período local
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: now };
      case "7":
        return { start: subDays(now, 7), end: now };
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth": {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case "custom":
        if (localDateRange?.from) {
          return {
            start: localDateRange.from,
            end: localDateRange.to || localDateRange.from,
          };
        }
        return { start: new Date(0), end: now };
      default:
        return { start: new Date(0), end: now };
    }
  }, [period, localDateRange]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case "all":
        return "Todos";
      case "today":
        return "Hoje";
      case "7":
        return "Últimos 7 dias";
      case "thisMonth":
        return "Mês atual";
      case "lastMonth":
        return "Mês anterior";
      case "custom":
        if (customStartDate && customEndDate) {
          return `${format(new Date(customStartDate), "dd/MM")} - ${format(new Date(customEndDate), "dd/MM")}`;
        }
        return "Personalizado";
      default:
        return "Todos";
    }
  }, [period, customStartDate, customEndDate]);

  const periodMetrics = useMemo(() => {
    const { start, end } = dateRange;

    const filterByRange = (orders: any[]) =>
      orders.filter((o) => {
        const dateField = o.order_date || o.created_at;
        if (!dateField) return false;
        const orderDate = parseISO(dateField);
        return isWithinInterval(orderDate, { start, end });
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

    const valorTotal = valorIgrejas + valorOnline;
    const qtdTotal = igrejasFiltered.length + onlineFiltered.length;

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
  }, [shopifyOrders, shopifyCGOrders, vendedorStats, dateRange]);

  // Marketplace: mesma lógica das páginas (new Date(order_date)) + período global
  const marketplaceData = useMemo(() => {
    const now = new Date();

    const filterMarketplaceByPeriod = (orders: MarketplacePedido[]) => {
      switch (period) {
        case "all":
          return orders;
        case "today": {
          const start = startOfDay(now);
          return orders.filter((p) => p.order_date && new Date(p.order_date) >= start);
        }
        case "7": {
          const sevenDaysAgo = subDays(now, 7);
          return orders.filter((p) => p.order_date && new Date(p.order_date) >= sevenDaysAgo);
        }
        case "thisMonth": {
          const start = startOfMonth(now);
          const end = endOfMonth(now);
          return orders.filter((p) => p.order_date && isWithinInterval(new Date(p.order_date), { start, end }));
        }
        case "lastMonth": {
          const lastMonth = subMonths(now, 1);
          const start = startOfMonth(lastMonth);
          const end = endOfMonth(lastMonth);
          return orders.filter((p) => p.order_date && isWithinInterval(new Date(p.order_date), { start, end }));
        }
        case "custom": {
          if (!customStartDate) return orders;
          const start = new Date(customStartDate);
          const endBase = customEndDate ? new Date(customEndDate) : start;
          return orders.filter((p) => {
            if (!p.order_date) return false;
            const date = new Date(p.order_date);
            return isWithinInterval(date, { start, end: new Date(endBase.getTime() + 86400000 - 1) });
          });
        }
        default:
          return orders;
      }
    };

    const amazonOrders = filterMarketplaceByPeriod(marketplacePedidos.filter((p) => p.marketplace === "AMAZON"));
    const shopeeOrders = filterMarketplaceByPeriod(marketplacePedidos.filter((p) => p.marketplace === "SHOPEE"));
    const mlOrders = filterMarketplaceByPeriod(marketplacePedidos.filter((p) => p.marketplace === "MERCADO_LIVRE"));
    const advecsOrders = filterMarketplaceByPeriod(marketplacePedidos.filter((p) => p.marketplace === "ADVECS"));
    const atacadoOrders = filterMarketplaceByPeriod(marketplacePedidos.filter((p) => p.marketplace === "ATACADO"));

    return {
      amazon: { valor: amazonOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: amazonOrders.length },
      shopee: { valor: shopeeOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: shopeeOrders.length },
      mercadoLivre: { valor: mlOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: mlOrders.length },
      advecs: { valor: advecsOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: advecsOrders.length },
      revendedores: { valor: 0, qtd: 0 },
      atacado: { valor: atacadoOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: atacadoOrders.length },
      representantes: { valor: 0, qtd: 0 },
    };
  }, [marketplacePedidos, period, customStartDate, customEndDate]);

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
          
          {/* Botões de filtro de período */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={localPeriod === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setLocalPeriod("today")}
            >
              Hoje
            </Button>
            <Button
              variant={localPeriod === "7" ? "default" : "outline"}
              size="sm"
              onClick={() => setLocalPeriod("7")}
            >
              7 dias
            </Button>
            <Button
              variant={localPeriod === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setLocalPeriod("thisMonth")}
            >
              Mês atual
            </Button>
            <Button
              variant={localPeriod === "lastMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setLocalPeriod("lastMonth")}
            >
              Mês anterior
            </Button>
            <Button
              variant={localPeriod === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setLocalPeriod("all")}
            >
              Todos
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={localPeriod === "custom" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                >
                  <CalendarIcon className="h-3 w-3" />
                  {localPeriod === "custom" && localDateRange?.from
                    ? `${format(localDateRange.from, "dd/MM")}${localDateRange.to ? ` - ${format(localDateRange.to, "dd/MM")}` : ""}`
                    : "Personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={localDateRange?.from}
                  selected={localDateRange}
                  onSelect={(range) => {
                    setLocalDateRange(range);
                    if (range?.from) {
                      setLocalPeriod("custom");
                    }
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            
            <span className="text-xs text-muted-foreground ml-auto">
              {periodLabel}
            </span>
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

        {/* Cards de Gestão (mantidos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Propostas Abertas</span>
            </div>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{propostasDigitaisAbertas}</p>
          </div>

          <div className="p-4 rounded-xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 dark:border-cyan-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-cyan-600" />
              <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">Bling Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{pedidosBlingPendentes}</p>
          </div>

          <div className="p-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 dark:border-indigo-800">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Comissão (est.)</span>
            </div>
            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
              {formatCurrency(periodMetrics.comissao)}
            </p>
          </div>
        </div>

        {/* Cards de Base */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Clientes EBD</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalEbdClients}</p>
          </div>

          <div className="p-4 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Alunos</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalAlunos ?? 0}</p>
          </div>

          <div className="p-4 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Church className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Turmas</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalTurmas ?? 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
