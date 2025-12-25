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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  DollarSign,
  TrendingUp,
  Users,
  Building2,
  CalendarIcon,
  Trophy,
  Medal,
  Award,
} from "lucide-react";
import {
  subMonths,
  parseISO,
  isWithinInterval,
  format,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type DateFilter = "month" | "quarter" | "semester" | "year" | "custom";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  comissao_percentual: number;
  status: string;
  meta_mensal_valor: number;
}

interface VendedoresSummaryCardsProps {
  vendedores: Vendedor[];
  shopifyOrders: any[];
  blingOrders: any[];
}

interface StandardCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  colorClass: string;
  borderColorClass: string;
  bgClass: string;
}

function StandardCard({
  icon,
  title,
  value,
  subtitle,
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
      {subtitle && <p className={`text-xs ${colorClass} opacity-70 mt-1`}>{subtitle}</p>}
    </div>
  );
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const normalizeEmail = (email: string | null | undefined): string => {
  if (!email) return "";
  return email.toLowerCase().trim();
};

const isPaidStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "paid" || s === "pago" || s === "aprovado" || s === "approved";
};

export function VendedoresSummaryCards({
  vendedores,
  shopifyOrders,
  blingOrders,
}: VendedoresSummaryCardsProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfMonth(now);
    let prevStart: Date;
    let prevEnd: Date;

    switch (dateFilter) {
      case "month":
        start = startOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        break;
      case "quarter":
        start = subMonths(startOfMonth(now), 2);
        prevStart = subMonths(start, 3);
        prevEnd = subMonths(start, 1);
        prevEnd = endOfMonth(prevEnd);
        break;
      case "semester":
        start = subMonths(startOfMonth(now), 5);
        prevStart = subMonths(start, 6);
        prevEnd = subMonths(start, 1);
        prevEnd = endOfMonth(prevEnd);
        break;
      case "year":
        start = subMonths(startOfMonth(now), 11);
        prevStart = subMonths(start, 12);
        prevEnd = subMonths(start, 1);
        prevEnd = endOfMonth(prevEnd);
        break;
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          start = customDateRange.from;
          end = customDateRange.to;
          const diffMs = end.getTime() - start.getTime();
          prevEnd = new Date(start.getTime() - 1);
          prevStart = new Date(prevEnd.getTime() - diffMs);
        } else {
          start = startOfMonth(now);
          prevStart = startOfMonth(subMonths(now, 1));
          prevEnd = endOfMonth(subMonths(now, 1));
        }
        break;
      default:
        start = startOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
    }

    return { start, end, prevStart, prevEnd };
  }, [dateFilter, customDateRange]);

  const periodLabel = useMemo(() => {
    if (dateFilter === "custom" && customDateRange.from && customDateRange.to) {
      return `${format(customDateRange.from, "dd/MM/yyyy")} - ${format(customDateRange.to, "dd/MM/yyyy")}`;
    }
    return format(dateRange.start, "MMM/yyyy", { locale: ptBR }) + " - " + format(dateRange.end, "MMM/yyyy", { locale: ptBR });
  }, [dateFilter, dateRange, customDateRange]);

  // Calculate metrics per vendedor
  const vendedorMetrics = useMemo(() => {
    const activeVendedores = vendedores.filter(v => v.status === "Ativo");
    
    // Map vendedor by ID for quick lookup
    const vendedorMap = new Map(activeVendedores.map(v => [v.id, v]));
    
    // Initialize metrics per vendedor
    const metrics = new Map<string, {
      vendedor: Vendedor;
      vendasPeriodo: number;
      vendasPeriodoAnterior: number;
      clientesAtivos: Set<string>;
      clientesNovos: Set<string>;
      vendasAdvec: number;
    }>();

    activeVendedores.forEach(v => {
      metrics.set(v.id, {
        vendedor: v,
        vendasPeriodo: 0,
        vendasPeriodoAnterior: 0,
        clientesAtivos: new Set(),
        clientesNovos: new Set(),
        vendasAdvec: 0,
      });
    });

    // Process Shopify orders (have vendedor_id)
    shopifyOrders.forEach(order => {
      if (!order.vendedor_id || !isPaidStatus(order.status_pagamento)) return;
      
      const orderDate = order.order_date ? parseISO(order.order_date) : null;
      if (!orderDate) return;

      const vendedorData = metrics.get(order.vendedor_id);
      if (!vendedorData) return;

      const clientKey = normalizeEmail(order.customer_email) || order.customer_name?.toLowerCase().trim();

      // Current period
      if (isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end })) {
        vendedorData.vendasPeriodo += Number(order.valor_total || 0);
        if (clientKey) vendedorData.clientesAtivos.add(clientKey);
      }

      // Previous period
      if (isWithinInterval(orderDate, { start: dateRange.prevStart, end: dateRange.prevEnd })) {
        vendedorData.vendasPeriodoAnterior += Number(order.valor_total || 0);
      }
    });

    return metrics;
  }, [vendedores, shopifyOrders, dateRange]);

  // Calculate aggregated metrics
  const aggregatedMetrics = useMemo(() => {
    const activeVendedores = vendedores.filter(v => v.status === "Ativo");
    
    // Meta total da equipe
    const metaTotal = activeVendedores.reduce((sum, v) => sum + (v.meta_mensal_valor || 0), 0);
    
    // Adjust meta based on period
    let metaPeriodo = metaTotal;
    if (dateFilter === "quarter") metaPeriodo = metaTotal * 3;
    else if (dateFilter === "semester") metaPeriodo = metaTotal * 6;
    else if (dateFilter === "year") metaPeriodo = metaTotal * 12;

    // Vendas totais do período (B2B: Shopify + Bling ADVECS/ATACADO)
    let vendasPeriodo = 0;
    let vendasPeriodoAnterior = 0;
    let vendasAdvec = 0;
    const clientesAtivos = new Set<string>();
    const clientesNovos = new Set<string>();
    const clientesAnterior = new Set<string>();

    // Process Shopify orders (vendas diretas B2B)
    shopifyOrders.forEach(order => {
      if (!isPaidStatus(order.status_pagamento)) return;
      
      const orderDate = order.order_date ? parseISO(order.order_date) : null;
      if (!orderDate) return;

      const clientKey = normalizeEmail(order.customer_email) || order.customer_name?.toLowerCase().trim();

      if (isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end })) {
        vendasPeriodo += Number(order.valor_total || 0);
        if (clientKey) clientesAtivos.add(clientKey);
      }

      if (isWithinInterval(orderDate, { start: dateRange.prevStart, end: dateRange.prevEnd })) {
        vendasPeriodoAnterior += Number(order.valor_total || 0);
        if (clientKey) clientesAnterior.add(clientKey);
      }
    });

    // Process Bling orders (ADVECS e ATACADO)
    blingOrders.forEach(order => {
      if (!isPaidStatus(order.status_pagamento)) return;
      
      const orderDate = order.order_date ? parseISO(order.order_date) : null;
      if (!orderDate) return;

      const clientKey = normalizeEmail(order.customer_email) || order.customer_name?.toLowerCase().trim();
      const isAdvec = order.marketplace === "ADVECS";

      if (isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end })) {
        vendasPeriodo += Number(order.valor_total || 0);
        if (clientKey) clientesAtivos.add(clientKey);
        if (isAdvec) vendasAdvec += Number(order.valor_total || 0);
      }

      if (isWithinInterval(orderDate, { start: dateRange.prevStart, end: dateRange.prevEnd })) {
        vendasPeriodoAnterior += Number(order.valor_total || 0);
        if (clientKey) clientesAnterior.add(clientKey);
      }
    });

    // Clientes novos = clientes ativos que não estavam no período anterior
    clientesAtivos.forEach(client => {
      if (!clientesAnterior.has(client)) {
        clientesNovos.add(client);
      }
    });

    // Percentual de atingimento da meta
    const percentAtingimento = metaPeriodo > 0 ? (vendasPeriodo / metaPeriodo) * 100 : 0;

    // Crescimento vs período anterior
    const crescimentoPercent = vendasPeriodoAnterior > 0 
      ? ((vendasPeriodo - vendasPeriodoAnterior) / vendasPeriodoAnterior) * 100 
      : vendasPeriodo > 0 ? 100 : 0;

    // Comissão média (5% default)
    const comissaoMedia = activeVendedores.length > 0
      ? activeVendedores.reduce((sum, v) => sum + (v.comissao_percentual || 5), 0) / activeVendedores.length
      : 5;

    // Comissão total estimada
    const comissaoTotal = vendasPeriodo * (comissaoMedia / 100);
    const comissaoPorVendedor = activeVendedores.length > 0 ? comissaoTotal / activeVendedores.length : 0;

    // Percentual ADVEC do total
    const percentAdvec = vendasPeriodo > 0 ? (vendasAdvec / vendasPeriodo) * 100 : 0;

    return {
      metaPeriodo,
      percentAtingimento,
      vendasPeriodo,
      crescimentoPercent,
      comissaoTotal,
      comissaoPorVendedor,
      clientesAtivos: clientesAtivos.size,
      clientesNovos: clientesNovos.size,
      vendasAdvec,
      percentAdvec,
    };
  }, [vendedores, shopifyOrders, blingOrders, dateRange, dateFilter]);

  // Ranking data per vendedor
  const rankingData = useMemo(() => {
    const activeVendedores = vendedores.filter(v => v.status === "Ativo");
    
    const vendedorSales = new Map<string, {
      vendedor: Vendedor;
      vendas: number;
      clientesAtivos: Set<string>;
    }>();

    activeVendedores.forEach(v => {
      vendedorSales.set(v.id, {
        vendedor: v,
        vendas: 0,
        clientesAtivos: new Set(),
      });
    });

    // Process Shopify orders
    shopifyOrders.forEach(order => {
      if (!order.vendedor_id || !isPaidStatus(order.status_pagamento)) return;
      
      const orderDate = order.order_date ? parseISO(order.order_date) : null;
      if (!orderDate) return;

      const vendedorData = vendedorSales.get(order.vendedor_id);
      if (!vendedorData) return;

      if (isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end })) {
        vendedorData.vendas += Number(order.valor_total || 0);
        const clientKey = normalizeEmail(order.customer_email) || order.customer_name?.toLowerCase().trim();
        if (clientKey) vendedorData.clientesAtivos.add(clientKey);
      }
    });

    // Convert to array and calculate metrics
    const ranking = Array.from(vendedorSales.values()).map(data => {
      const meta = data.vendedor.meta_mensal_valor || 0;
      let metaPeriodo = meta;
      if (dateFilter === "quarter") metaPeriodo = meta * 3;
      else if (dateFilter === "semester") metaPeriodo = meta * 6;
      else if (dateFilter === "year") metaPeriodo = meta * 12;

      const percentAtingimento = metaPeriodo > 0 ? (data.vendas / metaPeriodo) * 100 : 0;
      const comissao = data.vendas * ((data.vendedor.comissao_percentual || 5) / 100);

      return {
        vendedor: data.vendedor,
        vendas: data.vendas,
        percentAtingimento,
        comissao,
        clientesAtivos: data.clientesAtivos.size,
      };
    });

    // Sort by vendas descending
    return ranking.sort((a, b) => b.vendas - a.vendas);
  }, [vendedores, shopifyOrders, dateRange, dateFilter]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{index + 1}</span>;
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Performance de Vendedores
            </CardTitle>
            <CardDescription>
              Metas, vendas, comissão e ranking da equipe • {periodLabel}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["month", "quarter", "semester", "year"] as DateFilter[]).map((filter) => (
              <Button
                key={filter}
                variant={dateFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(filter)}
              >
                {filter === "month" ? "Mês" : filter === "quarter" ? "Trimestre" : filter === "semester" ? "Semestre" : "Ano"}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("custom")}
                >
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  Personalizado
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 5 Cards de Performance */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StandardCard
            icon={<Target className="h-4 w-4 text-blue-600" />}
            title="Meta de Vendas"
            value={formatCurrency(aggregatedMetrics.metaPeriodo)}
            subtitle={`${aggregatedMetrics.percentAtingimento.toFixed(1)}% atingido`}
            colorClass="text-blue-700 dark:text-blue-300"
            borderColorClass="border-blue-200 dark:border-blue-800"
            bgClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />

          <StandardCard
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            title="Vendas Realizadas"
            value={formatCurrency(aggregatedMetrics.vendasPeriodo)}
            subtitle={`${aggregatedMetrics.crescimentoPercent >= 0 ? "+" : ""}${aggregatedMetrics.crescimentoPercent.toFixed(1)}% vs anterior`}
            colorClass="text-emerald-700 dark:text-emerald-300"
            borderColorClass="border-emerald-200 dark:border-emerald-800"
            bgClass="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
          />

          <StandardCard
            icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
            title="Comissão Estimada"
            value={formatCurrency(aggregatedMetrics.comissaoTotal)}
            subtitle={`${formatCurrency(aggregatedMetrics.comissaoPorVendedor)}/vendedor`}
            colorClass="text-amber-700 dark:text-amber-300"
            borderColorClass="border-amber-200 dark:border-amber-800"
            bgClass="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900"
          />

          <StandardCard
            icon={<Users className="h-4 w-4 text-violet-600" />}
            title="Clientes Ativos"
            value={aggregatedMetrics.clientesAtivos}
            subtitle={`${aggregatedMetrics.clientesNovos} novos no período`}
            colorClass="text-violet-700 dark:text-violet-300"
            borderColorClass="border-violet-200 dark:border-violet-800"
            bgClass="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
          />

          <StandardCard
            icon={<Building2 className="h-4 w-4 text-indigo-600" />}
            title="Vendas ADVEC"
            value={formatCurrency(aggregatedMetrics.vendasAdvec)}
            subtitle={`${aggregatedMetrics.percentAdvec.toFixed(1)}% do total`}
            colorClass="text-indigo-700 dark:text-indigo-300"
            borderColorClass="border-indigo-200 dark:border-indigo-800"
            bgClass="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900"
          />
        </div>

        {/* Tabela de Ranking */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-center">% Meta</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="text-center">Clientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum vendedor ativo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                rankingData.map((item, index) => (
                  <TableRow key={item.vendedor.id}>
                    <TableCell>{getRankIcon(index)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.vendedor.foto_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {item.vendedor.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{item.vendedor.nome}</p>
                          <p className="text-xs text-muted-foreground">{item.vendedor.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.vendas)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center gap-1">
                        <Badge 
                          variant={item.percentAtingimento >= 100 ? "default" : item.percentAtingimento >= 70 ? "secondary" : "outline"}
                          className={item.percentAtingimento >= 100 ? "bg-emerald-500" : ""}
                        >
                          {item.percentAtingimento.toFixed(0)}%
                        </Badge>
                        <Progress 
                          value={Math.min(item.percentAtingimento, 100)} 
                          className="w-16 h-1.5" 
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.comissao)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{item.clientesAtivos}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
