import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  CalendarIcon,
  Loader2,
} from "lucide-react";
import {
  subDays,
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type DateFilter = "all" | "today" | "last_7_days" | "last_month" | "custom";

interface SalesChannelCardsProps {
  dashboardKPIs: any;
  totalEbdClients: number;
  totalAlunos: number | undefined;
  totalTurmas: number | undefined;
  shopifyOrders: any[];
  shopifyCGOrders: any[];
  vendedorStats: any[];
  propostasDigitaisAbertas: number;
  pedidosBlingPendentes: number;
  marketplacePedidos?: any[];
  propostasFaturadas?: any[];
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
  propostasFaturadas = [],
}: SalesChannelCardsProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Calcula o range de datas baseado no filtro selecionado
  const cardDateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today": {
        const start = startOfDay(now);
        const end = endOfDay(now);
        return { start, end };
      }
      case "last_7_days": {
        const start = subDays(startOfDay(now), 7);
        return { start, end: now };
      }
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        return { start, end };
      }
      case "custom": {
        if (!customDateRange.from) {
          return { start: new Date(0), end: now };
        }
        const start = startOfDay(customDateRange.from);
        const end = customDateRange.to 
          ? endOfDay(customDateRange.to) 
          : endOfDay(customDateRange.from);
        return { start, end };
      }
      default:
        return { start: new Date(0), end: now };
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

  // Query RPC para buscar totais agregados diretamente no banco
  // Evita o limite de 1000 registros do Supabase
  const { data: channelTotals, isLoading: isLoadingTotals } = useQuery({
    queryKey: ['sales-channel-totals', dateFilter, customDateRange.from?.toISOString(), customDateRange.to?.toISOString()],
    queryFn: async () => {
      const { start, end } = cardDateRange;
      
      // Para o filtro "all", passamos datas muito amplas
      const startDate = dateFilter === "all" ? new Date('2020-01-01').toISOString() : start.toISOString();
      const endDate = dateFilter === "all" ? new Date('2030-12-31').toISOString() : end.toISOString();
      
      const { data, error } = await supabase.rpc('get_sales_channel_totals', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      
      if (error) {
        console.error('Erro ao buscar totais de vendas:', error);
        throw error;
      }
      
      return data as {
        ecommerce: { valor: number; qtd: number };
        igreja_cnpj: { valor: number; qtd: number };
        igreja_cpf: { valor: number; qtd: number };
        lojistas: { valor: number; qtd: number };
        igrejas_total: { valor: number; qtd: number };
        amazon: { valor: number; qtd: number };
        shopee: { valor: number; qtd: number };
        mercado_livre: { valor: number; qtd: number };
        advecs: { valor: number; qtd: number };
        atacado: { valor: number; qtd: number };
        propostas_advecs: { valor: number; qtd: number };
        propostas_revendedores: { valor: number; qtd: number };
        propostas_representantes: { valor: number; qtd: number };
      };
    },
    staleTime: 30000, // Cache por 30 segundos
  });

  // Calcula métricas baseadas nos dados do RPC
  const periodMetrics = useMemo(() => {
    if (!channelTotals) {
      return {
        qtdOnline: 0,
        valorOnline: 0,
        qtdIgrejas: 0,
        valorIgrejas: 0,
        qtdIgrejasCNPJ: 0,
        valorIgrejasCNPJ: 0,
        qtdIgrejasCPF: 0,
        valorIgrejasCPF: 0,
        qtdLojistas: 0,
        valorLojistas: 0,
      };
    }

    return {
      qtdOnline: channelTotals.ecommerce?.qtd || 0,
      valorOnline: Number(channelTotals.ecommerce?.valor) || 0,
      qtdIgrejas: channelTotals.igrejas_total?.qtd || 0,
      valorIgrejas: Number(channelTotals.igrejas_total?.valor) || 0,
      qtdIgrejasCNPJ: channelTotals.igreja_cnpj?.qtd || 0,
      valorIgrejasCNPJ: Number(channelTotals.igreja_cnpj?.valor) || 0,
      qtdIgrejasCPF: channelTotals.igreja_cpf?.qtd || 0,
      valorIgrejasCPF: Number(channelTotals.igreja_cpf?.valor) || 0,
      qtdLojistas: channelTotals.lojistas?.qtd || 0,
      valorLojistas: Number(channelTotals.lojistas?.valor) || 0,
    };
  }, [channelTotals]);

  // Dados dos marketplaces baseados no RPC
  const marketplaceData = useMemo(() => {
    if (!channelTotals) {
      return {
        amazon: { valor: 0, qtd: 0 },
        shopee: { valor: 0, qtd: 0 },
        mercadoLivre: { valor: 0, qtd: 0 },
        advecs: { valor: 0, qtd: 0 },
        revendedores: { valor: 0, qtd: 0 },
        atacado: { valor: 0, qtd: 0 },
        representantes: { valor: 0, qtd: 0 },
      };
    }

    // ADVECS = pedidos marketplace ADVECS + propostas tipo Igreja
    const advecsValor = Number(channelTotals.advecs?.valor || 0) + Number(channelTotals.propostas_advecs?.valor || 0);
    const advecsQtd = (channelTotals.advecs?.qtd || 0) + (channelTotals.propostas_advecs?.qtd || 0);

    return {
      amazon: { 
        valor: Number(channelTotals.amazon?.valor) || 0, 
        qtd: channelTotals.amazon?.qtd || 0 
      },
      shopee: { 
        valor: Number(channelTotals.shopee?.valor) || 0, 
        qtd: channelTotals.shopee?.qtd || 0 
      },
      mercadoLivre: { 
        valor: Number(channelTotals.mercado_livre?.valor) || 0, 
        qtd: channelTotals.mercado_livre?.qtd || 0 
      },
      advecs: { 
        valor: advecsValor, 
        qtd: advecsQtd 
      },
      revendedores: { 
        valor: Number(channelTotals.propostas_revendedores?.valor) || 0, 
        qtd: channelTotals.propostas_revendedores?.qtd || 0 
      },
      atacado: { 
        valor: Number(channelTotals.atacado?.valor) || 0, 
        qtd: channelTotals.atacado?.qtd || 0 
      },
      representantes: { 
        valor: Number(channelTotals.propostas_representantes?.valor) || 0, 
        qtd: channelTotals.propostas_representantes?.qtd || 0 
      },
    };
  }, [channelTotals]);

  // Calcula o total geral somando todos os canais
  const totalGeral = useMemo(() => {
    const valorTotal = 
      periodMetrics.valorOnline + 
      periodMetrics.valorIgrejas + 
      marketplaceData.amazon.valor + 
      marketplaceData.shopee.valor + 
      marketplaceData.mercadoLivre.valor + 
      marketplaceData.advecs.valor + 
      marketplaceData.revendedores.valor + 
      marketplaceData.atacado.valor + 
      marketplaceData.representantes.valor;
    
    const qtdTotal = 
      periodMetrics.qtdOnline + 
      periodMetrics.qtdIgrejas + 
      marketplaceData.amazon.qtd + 
      marketplaceData.shopee.qtd + 
      marketplaceData.mercadoLivre.qtd + 
      marketplaceData.advecs.qtd + 
      marketplaceData.revendedores.qtd + 
      marketplaceData.atacado.qtd + 
      marketplaceData.representantes.qtd;
    
    return { valorTotal, qtdTotal };
  }, [periodMetrics, marketplaceData]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Resumo de Vendas
                {isLoadingTotals && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>Métricas consolidadas de todos os canais de venda</CardDescription>
            </div>
          </div>
          
          {/* Botões de filtro de período */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "today", label: "Hoje" },
              { value: "last_7_days", label: "7 dias" },
              { value: "last_month", label: "Mês anterior" },
              { value: "all", label: "Todos" },
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
            title="E-commerce"
            value={formatCurrency(periodMetrics.valorOnline)}
            periodLabel={`${periodMetrics.qtdOnline} pedidos`}
            colorClass="text-blue-700 dark:text-blue-300"
            borderColorClass="border-blue-200 dark:border-blue-800"
            bgClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />

          <StandardCard
            icon={<Building2 className="h-4 w-4 text-green-600" />}
            title="Igreja CNPJ"
            value={formatCurrency(periodMetrics.valorIgrejasCNPJ)}
            periodLabel={`${periodMetrics.qtdIgrejasCNPJ} pedidos`}
            colorClass="text-green-700 dark:text-green-300"
            borderColorClass="border-green-200 dark:border-green-800"
            bgClass="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
          />

          <StandardCard
            icon={<Church className="h-4 w-4 text-emerald-600" />}
            title="Igreja CPF"
            value={formatCurrency(periodMetrics.valorIgrejasCPF)}
            periodLabel={`${periodMetrics.qtdIgrejasCPF} pedidos`}
            colorClass="text-emerald-700 dark:text-emerald-300"
            borderColorClass="border-emerald-200 dark:border-emerald-800"
            bgClass="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
          />

          <StandardCard
            icon={<Store className="h-4 w-4 text-lime-600" />}
            title="Lojistas"
            value={formatCurrency(periodMetrics.valorLojistas)}
            periodLabel={`${periodMetrics.qtdLojistas} pedidos`}
            colorClass="text-lime-700 dark:text-lime-300"
            borderColorClass="border-lime-200 dark:border-lime-800"
            bgClass="bg-gradient-to-br from-lime-50 to-lime-100 dark:from-lime-950 dark:to-lime-900"
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
            value={formatCurrency(totalGeral.valorTotal)}
            periodLabel={`${totalGeral.qtdTotal} pedidos • ${periodLabel}`}
            colorClass="text-emerald-700 dark:text-emerald-300"
            borderColorClass="border-emerald-300 dark:border-emerald-700"
            bgClass="bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-950 dark:to-emerald-900"
          />
        </div>
      </CardContent>
    </Card>
  );
}
