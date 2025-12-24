import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  CalendarIcon,
} from "lucide-react";
import { startOfDay, subDays, parseISO, isWithinInterval, endOfDay, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

type PeriodFilter = "today" | "7days" | "30days" | "custom";

// Componente de Card padronizado
interface StandardCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  periodLabel: string;
  colorClass: string;
  borderColorClass: string;
  bgClass: string;
}

function StandardCard({ icon, title, value, periodLabel, colorClass, borderColorClass, bgClass }: StandardCardProps) {
  return (
    <div className={`p-4 rounded-xl border-2 ${borderColorClass} ${bgClass} flex flex-col h-full min-h-[120px]`}>
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
}: SalesChannelCardsProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    const endDate = endOfDay(now);
    
    switch (periodFilter) {
      case "today":
        return { start: startOfDay(now), end: endDate, label: "Hoje" };
      case "7days":
        return { start: startOfDay(subDays(now, 7)), end: endDate, label: "Últimos 7 dias" };
      case "30days":
        return { start: startOfDay(subDays(now, 30)), end: endDate, label: "Últimos 30 dias" };
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          return { 
            start: startOfDay(customDateRange.from), 
            end: endOfDay(customDateRange.to),
            label: `${format(customDateRange.from, "dd/MM")} - ${format(customDateRange.to, "dd/MM")}`
          };
        }
        return { start: startOfDay(now), end: endDate, label: "Hoje" };
      default:
        return { start: startOfDay(now), end: endDate, label: "Hoje" };
    }
  }, [periodFilter, customDateRange]);

  // Calculate metrics based on selected period
  const periodMetrics = useMemo(() => {
    const { start, end } = dateRange;

    // Helper to filter orders by date range - use order_date if available, fallback to created_at
    const filterByRange = (orders: any[]) => {
      return orders.filter(o => {
        const dateField = o.order_date || o.created_at;
        if (!dateField) return false;
        const orderDate = parseISO(dateField);
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
    const igrejasFiltered = filterByRange(paidShopifyOrders);
    const valorIgrejas = igrejasFiltered.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    const qtdIgrejas = igrejasFiltered.length;

    // Pedidos Online (CG)
    const onlineFiltered = filterByRange(paidShopifyCGOrders);
    const valorOnline = onlineFiltered.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    const qtdOnline = onlineFiltered.length;

    // Total
    const valorTotal = valorIgrejas + valorOnline;
    const qtdTotal = qtdIgrejas + qtdOnline;

    // Commission calculations
    const comissao = vendedorStats.reduce((sum, v) => {
      const vendedorOrders = filterByRange(
        shopifyOrders.filter(o => o.vendedor_id === v.id)
      );
      const valorVendedor = vendedorOrders.reduce((s, o) => s + Number(o.valor_para_meta || o.valor_total || 0), 0);
      return sum + valorVendedor * (v.comissao_percentual / 100);
    }, 0);

    return {
      // Pedidos Online
      qtdOnline,
      valorOnline,
      // Pedidos Igrejas
      qtdIgrejas,
      valorIgrejas,
      // Total
      valorTotal,
      qtdTotal,
      // Comissão
      comissao,
    };
  }, [shopifyOrders, shopifyCGOrders, vendedorStats, dateRange]);

  // Calculate marketplace data from marketplacePedidos
  const marketplaceData = useMemo(() => {
    const { start, end } = dateRange;
    
    const filterByRange = (orders: MarketplacePedido[]) => {
      return orders.filter((o) => {
        const dateField = o.order_date || o.created_at;
        if (!dateField) return false;

        // `order_date` às vezes vem como DATE puro ("YYYY-MM-DD").
        // `new Date("YYYY-MM-DD")` interpreta como UTC e pode cair no dia anterior no fuso BR,
        // zerando os Cards. Então tratamos DATE puro como local via parseISO.
        let orderDate: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateField)) {
          orderDate = parseISO(dateField);
        } else {
          // Alguns timestamps podem vir como "YYYY-MM-DD HH:mm:ss+00"; normalize para ISO.
          const normalized = dateField.includes(" ") ? dateField.replace(" ", "T") : dateField;
          orderDate = parseISO(normalized);
          if (Number.isNaN(orderDate.getTime())) {
            orderDate = new Date(dateField);
          }
        }

        if (Number.isNaN(orderDate.getTime())) return false;
        return isWithinInterval(orderDate, { start, end });
      });
    };

    const amazonOrders = filterByRange(marketplacePedidos.filter(p => p.marketplace === 'AMAZON'));
    const shopeeOrders = filterByRange(marketplacePedidos.filter(p => p.marketplace === 'SHOPEE'));
    const mlOrders = filterByRange(marketplacePedidos.filter(p => p.marketplace === 'MERCADO_LIVRE'));
    const advecsOrders = filterByRange(marketplacePedidos.filter(p => p.marketplace === 'ADVECS'));
    const atacadoOrders = filterByRange(marketplacePedidos.filter(p => p.marketplace === 'ATACADO'));

    return {
      amazon: { valor: amazonOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: amazonOrders.length },
      shopee: { valor: shopeeOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: shopeeOrders.length },
      mercadoLivre: { valor: mlOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: mlOrders.length },
      advecs: { valor: advecsOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: advecsOrders.length },
      revendedores: { valor: 0, qtd: 0 },
      atacado: { valor: atacadoOrders.reduce((s, o) => s + Number(o.valor_total), 0), qtd: atacadoOrders.length },
      representantes: { valor: 0, qtd: 0 },
    };
  }, [marketplacePedidos, dateRange]);

  const periodButtons = [
    { value: "today" as PeriodFilter, label: "Hoje" },
    { value: "7days" as PeriodFilter, label: "7 dias" },
    { value: "30days" as PeriodFilter, label: "30 dias" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Resumo de Vendas
            </CardTitle>
            <CardDescription>Métricas consolidadas de todos os canais de venda</CardDescription>
          </div>
          
          {/* Filtro de Período */}
          <div className="flex items-center gap-2 flex-wrap">
            {periodButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={periodFilter === btn.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodFilter(btn.value)}
                className="text-xs"
              >
                {btn.label}
              </Button>
            ))}
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={periodFilter === "custom" ? "default" : "outline"}
                  size="sm"
                  className={cn("text-xs gap-1", periodFilter === "custom" && customDateRange.from && "min-w-[140px]")}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {periodFilter === "custom" && customDateRange.from && customDateRange.to
                    ? `${format(customDateRange.from, "dd/MM")} - ${format(customDateRange.to, "dd/MM")}`
                    : "Período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange.from || new Date()}
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => {
                    setCustomDateRange({ from: range?.from, to: range?.to });
                    if (range?.from && range?.to) {
                      setPeriodFilter("custom");
                    }
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grid unificado de todos os canais de venda */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Pedidos Online */}
          <StandardCard
            icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
            title="Pedidos Online"
            value={formatCurrency(periodMetrics.valorOnline)}
            periodLabel={`${periodMetrics.qtdOnline} pedidos`}
            colorClass="text-blue-700 dark:text-blue-300"
            borderColorClass="border-blue-200 dark:border-blue-800"
            bgClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />

          {/* Pedidos Igrejas */}
          <StandardCard
            icon={<Church className="h-4 w-4 text-green-600" />}
            title="Pedidos Igrejas"
            value={formatCurrency(periodMetrics.valorIgrejas)}
            periodLabel={`${periodMetrics.qtdIgrejas} pedidos`}
            colorClass="text-green-700 dark:text-green-300"
            borderColorClass="border-green-200 dark:border-green-800"
            bgClass="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
          />

          {/* Amazon */}
          <StandardCard
            icon={<Package className="h-4 w-4 text-orange-600" />}
            title="Amazon"
            value={formatCurrency(marketplaceData.amazon.valor)}
            periodLabel={`${marketplaceData.amazon.qtd} pedidos`}
            colorClass="text-orange-700 dark:text-orange-300"
            borderColorClass="border-orange-200 dark:border-orange-800"
            bgClass="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
          />

          {/* Shopee */}
          <StandardCard
            icon={<Store className="h-4 w-4 text-red-600" />}
            title="Shopee"
            value={formatCurrency(marketplaceData.shopee.valor)}
            periodLabel={`${marketplaceData.shopee.qtd} pedidos`}
            colorClass="text-red-700 dark:text-red-300"
            borderColorClass="border-red-200 dark:border-red-800"
            bgClass="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"
          />

          {/* Mercado Livre */}
          <StandardCard
            icon={<ShoppingCart className="h-4 w-4 text-yellow-600" />}
            title="Mercado Livre"
            value={formatCurrency(marketplaceData.mercadoLivre.valor)}
            periodLabel={`${marketplaceData.mercadoLivre.qtd} pedidos`}
            colorClass="text-yellow-700 dark:text-yellow-300"
            borderColorClass="border-yellow-200 dark:border-yellow-800"
            bgClass="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900"
          />

          {/* ADVECS */}
          <StandardCard
            icon={<Building2 className="h-4 w-4 text-teal-600" />}
            title="ADVECS"
            value={formatCurrency(marketplaceData.advecs.valor)}
            periodLabel={`${marketplaceData.advecs.qtd} pedidos`}
            colorClass="text-teal-700 dark:text-teal-300"
            borderColorClass="border-teal-200 dark:border-teal-800"
            bgClass="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900"
          />

          {/* Revendedores */}
          <StandardCard
            icon={<UserCheck className="h-4 w-4 text-violet-600" />}
            title="Revendedores"
            value={formatCurrency(marketplaceData.revendedores.valor)}
            periodLabel={`${marketplaceData.revendedores.qtd} pedidos`}
            colorClass="text-violet-700 dark:text-violet-300"
            borderColorClass="border-violet-200 dark:border-violet-800"
            bgClass="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
          />

          {/* Atacado */}
          <StandardCard
            icon={<Briefcase className="h-4 w-4 text-sky-600" />}
            title="Atacado"
            value={formatCurrency(marketplaceData.atacado.valor)}
            periodLabel={`${marketplaceData.atacado.qtd} pedidos`}
            colorClass="text-sky-700 dark:text-sky-300"
            borderColorClass="border-sky-200 dark:border-sky-800"
            bgClass="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900"
          />

          {/* Representantes */}
          <StandardCard
            icon={<Users className="h-4 w-4 text-rose-600" />}
            title="Representantes"
            value={formatCurrency(marketplaceData.representantes.valor)}
            periodLabel={`${marketplaceData.representantes.qtd} pedidos`}
            colorClass="text-rose-700 dark:text-rose-300"
            borderColorClass="border-rose-200 dark:border-rose-800"
            bgClass="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900"
          />

          {/* TOTAL GERAL */}
          <StandardCard
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            title="TOTAL GERAL"
            value={formatCurrency(periodMetrics.valorTotal)}
            periodLabel={`${periodMetrics.qtdTotal} pedidos • ${dateRange.label}`}
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
            <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">{formatCurrency(periodMetrics.comissao)}</p>
            <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">{dateRange.label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
