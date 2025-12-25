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
  Users,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Percent,
  RefreshCw,
  UserX,
  DollarSign,
  Building2,
  CalendarIcon,
  Activity,
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

interface ClientsSummaryCardsProps {
  shopifyOrders: any[];
  ebdClients: any[];
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

// Normalizar email para comparação
const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  return email.toLowerCase().trim();
};

// Normalizar status de pagamento
const isPaidStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'pago' || s === 'paid' || s === 'faturado' || s === 'approved';
};

export function ClientsSummaryCards({ shopifyOrders, ebdClients }: ClientsSummaryCardsProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("quarter");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Buscar pedidos do Bling Marketplace (Amazon, Shopee, ML, Atacado)
  const { data: blingOrders = [] } = useQuery({
    queryKey: ["clients-summary-bling-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bling_marketplace_pedidos")
        .select("*")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Total de Igrejas ADVEC direto do Bling (Clientes/Fornecedores)
  const { data: blingAdvecTotalData } = useQuery({
    queryKey: ["bling-advec-total"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("bling-advec-total");
      if (error) throw error;
      return data as { totalAdvec?: number };
    },
  });
  const blingAdvecTotal = blingAdvecTotalData?.totalAdvec;


  // Buscar todos os clientes ebd_clientes para mapeamento por email
  const { data: allEbdClientes = [] } = useQuery({
    queryKey: ["all-ebd-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, email_superintendente, created_at, tipo_cliente");
      if (error) throw error;
      return data || [];
    },
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "month": {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const previousStart = startOfMonth(subMonths(now, 1));
        const previousEnd = endOfMonth(subMonths(now, 1));
        return { start, end, previousStart, previousEnd };
      }
      case "quarter": {
        const start = subMonths(now, 3);
        return { start, end: now, previousStart: subMonths(now, 6), previousEnd: subMonths(now, 3) };
      }
      case "semester": {
        const start = subMonths(now, 6);
        return { start, end: now, previousStart: subMonths(now, 12), previousEnd: subMonths(now, 6) };
      }
      case "year": {
        const start = subMonths(now, 12);
        return { start, end: now, previousStart: subMonths(now, 24), previousEnd: subMonths(now, 12) };
      }
      case "custom": {
        if (!customDateRange.from) {
          const start = subMonths(now, 3);
          return { start, end: now, previousStart: subMonths(now, 6), previousEnd: subMonths(now, 3) };
        }
        const start = customDateRange.from;
        const end = customDateRange.to || customDateRange.from;
        const duration = end.getTime() - start.getTime();
        const previousStart = new Date(start.getTime() - duration);
        const previousEnd = new Date(end.getTime() - duration);
        return { start, end, previousStart, previousEnd };
      }
      default:
        const start = subMonths(now, 3);
        return { start, end: now, previousStart: subMonths(now, 6), previousEnd: subMonths(now, 3) };
    }
  }, [dateFilter, customDateRange]);

  const periodLabel = useMemo(() => {
    switch (dateFilter) {
      case "month":
        return "Mês Atual";
      case "quarter":
        return "Último Trimestre";
      case "semester":
        return "Último Semestre";
      case "year":
        return "Último Ano";
      case "custom":
        if (customDateRange.from) {
          const from = format(customDateRange.from, "dd/MM");
          const to = customDateRange.to ? format(customDateRange.to, "dd/MM") : from;
          return `${from} - ${to}`;
        }
        return "Personalizado";
      default:
        return "Último Trimestre";
    }
  }, [dateFilter, customDateRange]);

  // Unificar todos os pedidos de todos os canais
  const allOrders = useMemo(() => {
    // Pedidos Shopify (igrejas) - tem cliente_id e customer_email
    const shopifyNormalized = shopifyOrders.map(o => ({
      id: o.id,
      cliente_id: o.cliente_id,
      customer_email: normalizeEmail(o.customer_email),
      customer_name: o.customer_name,
      order_date: o.order_date || o.created_at,
      valor_total: Number(o.valor_total || 0),
      status_pagamento: o.status_pagamento,
      source: 'shopify' as const,
    }));

    // Pedidos Bling Marketplace - tem customer_email
    const blingNormalized = blingOrders.map(o => ({
      id: o.id,
      cliente_id: null,
      customer_email: normalizeEmail(o.customer_email),
      customer_name: o.customer_name,
      order_date: o.order_date || o.created_at,
      valor_total: Number(o.valor_total || 0),
      status_pagamento: o.status_pagamento,
      source: 'bling' as const,
    }));

    return [...shopifyNormalized, ...blingNormalized];
  }, [shopifyOrders, blingOrders]);

  // Mapa de email -> cliente_id (para unificar clientes)
  const emailToClientMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    // Mapear clientes ebd_clientes
    allEbdClientes.forEach(c => {
      const email = normalizeEmail(c.email_superintendente);
      if (email) {
        map[email] = c.id;
      }
    });

    // Mapear pedidos Shopify com cliente_id
    shopifyOrders.forEach(o => {
      const email = normalizeEmail(o.customer_email);
      if (email && o.cliente_id) {
        map[email] = o.cliente_id;
      }
    });

    return map;
  }, [allEbdClientes, shopifyOrders]);

  // Função para obter ID único do cliente (por email ou cliente_id)
  const getClientKey = (order: any): string | null => {
    // Priorizar email normalizado
    if (order.customer_email) {
      return order.customer_email;
    }
    // Fallback para cliente_id
    if (order.cliente_id) {
      return order.cliente_id;
    }
    return null;
  };

  const clientMetrics = useMemo(() => {
    const { start, end, previousStart, previousEnd } = dateRange;

    // Função para verificar se um pedido está no período
    const isInPeriod = (orderDate: string | null, periodStart: Date, periodEnd: Date) => {
      if (!orderDate) return false;
      try {
        const date = parseISO(orderDate);
        return isWithinInterval(date, { start: periodStart, end: periodEnd });
      } catch {
        return false;
      }
    };

    // Filtrar pedidos pagos de TODAS as fontes
    const paidOrders = allOrders.filter(o => isPaidStatus(o.status_pagamento));

    // Clientes ativos no período atual (com compra paga)
    const currentPeriodOrders = paidOrders.filter(o => 
      isInPeriod(o.order_date, start, end)
    );
    const currentActiveClients = new Set(
      currentPeriodOrders.map(o => getClientKey(o)).filter(Boolean)
    );

    // Clientes ativos no período anterior
    const previousPeriodOrders = paidOrders.filter(o => 
      isInPeriod(o.order_date, previousStart, previousEnd)
    );
    const previousActiveClients = new Set(
      previousPeriodOrders.map(o => getClientKey(o)).filter(Boolean)
    );

    // Card 1: Clientes Ativos no Período
    const clientesAtivos = currentActiveClients.size;

    // Card 2: % Ativos vs Anterior
    const percentAtivosVsAnterior = previousActiveClients.size > 0
      ? ((clientesAtivos - previousActiveClients.size) / previousActiveClients.size) * 100
      : clientesAtivos > 0 ? 100 : 0;

    // Card 3: Novos Clientes (primeira compra no período)
    // Identificar a primeira compra de cada cliente em todo o histórico
    const clientFirstPurchase: Record<string, Date> = {};
    paidOrders.forEach(o => {
      const key = getClientKey(o);
      if (!key || !o.order_date) return;
      try {
        const date = parseISO(o.order_date);
        if (!clientFirstPurchase[key] || date < clientFirstPurchase[key]) {
          clientFirstPurchase[key] = date;
        }
      } catch {
        // ignore invalid dates
      }
    });

    // Contar clientes cuja primeira compra está no período atual
    const novosClientes = Object.entries(clientFirstPurchase).filter(([_, firstDate]) => 
      isWithinInterval(firstDate, { start, end })
    ).length;

    // Card 4: % Crescimento da Base
    const totalBaseClientes = allEbdClientes.length || ebdClients?.length || 1;
    const percentCrescimentoBase = totalBaseClientes > 0
      ? (novosClientes / totalBaseClientes) * 100
      : 0;

    // Card 5: Clientes Recorrentes (2+ compras no período)
    const clientOrderCount: Record<string, number> = {};
    currentPeriodOrders.forEach(o => {
      const key = getClientKey(o);
      if (key) {
        clientOrderCount[key] = (clientOrderCount[key] || 0) + 1;
      }
    });
    const clientesRecorrentes = Object.values(clientOrderCount).filter(count => count >= 2).length;

    // Card 6: Taxa de Recorrência
    const taxaRecorrencia = clientesAtivos > 0
      ? (clientesRecorrentes / clientesAtivos) * 100
      : 0;

    // Card 7: Clientes Inativos (sem compra nos últimos 6 meses)
    const sixMonthsAgo = subMonths(new Date(), 6);
    const recentOrders = paidOrders.filter(o => {
      if (!o.order_date) return false;
      try {
        const date = parseISO(o.order_date);
        return date >= sixMonthsAgo;
      } catch {
        return false;
      }
    });
    const recentActiveClients = new Set(
      recentOrders.map(o => getClientKey(o)).filter(Boolean)
    );
    
    // Clientes conhecidos que não estão ativos recentemente
    const allKnownClients = new Set(
      paidOrders.map(o => getClientKey(o)).filter(Boolean)
    );
    const inactiveClients = [...allKnownClients].filter(key => !recentActiveClients.has(key));
    const clientesInativos = inactiveClients.length;

    // Card 8: Potencial de Reativação (receita média por cliente inativo)
    const clientTotalValue: Record<string, number> = {};
    paidOrders.forEach(o => {
      const key = getClientKey(o);
      if (key) {
        clientTotalValue[key] = (clientTotalValue[key] || 0) + o.valor_total;
      }
    });
    const inactiveClientValues = inactiveClients.map(key => clientTotalValue[key] || 0);
    const potencialReativacao = inactiveClientValues.length > 0
      ? inactiveClientValues.reduce((a, b) => a + b, 0) / inactiveClientValues.length
      : 0;

    // Cards 9-10: ADVEC - buscar diretamente dos pedidos Bling
    // Identificar clientes ADVEC pelo nome: "ADVEC" ou "Assembleia de Deus Vitória em Cristo"
    const isAdvecClient = (name: string | null | undefined): boolean => {
      if (!name) return false;
      const n = name.toLowerCase();
      return n.includes('advec') || n.includes('assembleia de deus vitória em cristo') || n.includes('assembleia de deus vitoria em cristo');
    };
    
    // Buscar clientes ADVEC únicos de TODOS os pedidos Bling (sem filtro de período)
    const advecUniqueClients = new Set<string>();
    blingOrders.forEach(order => {
      if (isAdvecClient(order.customer_name)) {
        // Usar email normalizado ou nome como chave única
        const key = normalizeEmail(order.customer_email) || order.customer_name?.toLowerCase().trim();
        if (key) advecUniqueClients.add(key);
      }
    });
    const totalAdvec = advecUniqueClients.size;
    
    // Total de clientes únicos em TODOS os pedidos Bling (para calcular Atacado)
    const allBlingUniqueClients = new Set<string>();
    blingOrders.forEach(order => {
      const key = normalizeEmail(order.customer_email) || order.customer_name?.toLowerCase().trim();
      if (key) allBlingUniqueClients.add(key);
    });
    
    // Clientes Atacado = Total clientes Bling - ADVECs
    const clientesAtacado = allBlingUniqueClients.size - advecUniqueClients.size;

    return {
      clientesAtivos,
      percentAtivosVsAnterior,
      novosClientes,
      percentCrescimentoBase,
      clientesRecorrentes,
      taxaRecorrencia,
      clientesInativos,
      potencialReativacao,
      totalAdvec,
      clientesAtacado: Math.max(0, clientesAtacado),
    };
  }, [allOrders, ebdClients, allEbdClientes, blingOrders, dateRange]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Resumo de Clientes
              </CardTitle>
              <CardDescription>Métricas de crescimento e fidelidade da base de clientes</CardDescription>
            </div>
          </div>

          {/* Filtros de período */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "month", label: "Mês" },
              { value: "quarter", label: "Trimestre" },
              { value: "semester", label: "Semestre" },
              { value: "year", label: "Ano" },
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
        {/* Primeira linha: Clientes Ativos e Novos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StandardCard
            icon={<Users className="h-4 w-4 text-blue-600" />}
            title="Clientes Ativos"
            value={clientMetrics.clientesAtivos}
            subtitle="Com compra no período"
            colorClass="text-blue-700 dark:text-blue-300"
            borderColorClass="border-blue-200 dark:border-blue-800"
            bgClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />

          <StandardCard
            icon={clientMetrics.percentAtivosVsAnterior >= 0 
              ? <TrendingUp className="h-4 w-4 text-green-600" />
              : <TrendingDown className="h-4 w-4 text-red-600" />
            }
            title="% Ativos vs. Anterior"
            value={`${clientMetrics.percentAtivosVsAnterior >= 0 ? "+" : ""}${clientMetrics.percentAtivosVsAnterior.toFixed(1)}%`}
            subtitle="Comparado ao período anterior"
            colorClass={clientMetrics.percentAtivosVsAnterior >= 0 
              ? "text-green-700 dark:text-green-300" 
              : "text-red-700 dark:text-red-300"
            }
            borderColorClass={clientMetrics.percentAtivosVsAnterior >= 0 
              ? "border-green-200 dark:border-green-800"
              : "border-red-200 dark:border-red-800"
            }
            bgClass={clientMetrics.percentAtivosVsAnterior >= 0 
              ? "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
              : "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"
            }
          />

          <StandardCard
            icon={<UserPlus className="h-4 w-4 text-violet-600" />}
            title="Novos Clientes"
            value={clientMetrics.novosClientes}
            subtitle="Primeira compra no período"
            colorClass="text-violet-700 dark:text-violet-300"
            borderColorClass="border-violet-200 dark:border-violet-800"
            bgClass="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
          />

          <StandardCard
            icon={<Percent className="h-4 w-4 text-cyan-600" />}
            title="% Crescimento Base"
            value={`${clientMetrics.percentCrescimentoBase.toFixed(1)}%`}
            subtitle="Novos / Total da Base"
            colorClass="text-cyan-700 dark:text-cyan-300"
            borderColorClass="border-cyan-200 dark:border-cyan-800"
            bgClass="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900"
          />
        </div>

        {/* Segunda linha: Recorrência e Inatividade */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StandardCard
            icon={<RefreshCw className="h-4 w-4 text-emerald-600" />}
            title="Clientes Recorrentes"
            value={clientMetrics.clientesRecorrentes}
            subtitle="2+ compras no período"
            colorClass="text-emerald-700 dark:text-emerald-300"
            borderColorClass="border-emerald-200 dark:border-emerald-800"
            bgClass="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
          />

          <StandardCard
            icon={<Activity className="h-4 w-4 text-teal-600" />}
            title="Taxa de Recorrência"
            value={`${clientMetrics.taxaRecorrencia.toFixed(1)}%`}
            subtitle="Recorrentes / Ativos"
            colorClass="text-teal-700 dark:text-teal-300"
            borderColorClass="border-teal-200 dark:border-teal-800"
            bgClass="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900"
          />

          <StandardCard
            icon={<UserX className="h-4 w-4 text-orange-600" />}
            title="Clientes Inativos (6M)"
            value={clientMetrics.clientesInativos}
            subtitle="Sem compra há 6 meses"
            colorClass="text-orange-700 dark:text-orange-300"
            borderColorClass="border-orange-200 dark:border-orange-800"
            bgClass="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
          />

          <StandardCard
            icon={<DollarSign className="h-4 w-4 text-amber-600" />}
            title="Potencial Reativação"
            value={formatCurrency(clientMetrics.potencialReativacao)}
            subtitle="Receita média por inativo"
            colorClass="text-amber-700 dark:text-amber-300"
            borderColorClass="border-amber-200 dark:border-amber-800"
            bgClass="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900"
          />
        </div>

        {/* Terceira linha: ADVEC */}
        <div className="grid grid-cols-2 gap-3">
          <StandardCard
            icon={<Building2 className="h-4 w-4 text-indigo-600" />}
            title="Total Igrejas ADVEC"
            value={blingAdvecTotal ?? clientMetrics.totalAdvec}
            subtitle="Clientes/fornecedores no Bling"
            colorClass="text-indigo-700 dark:text-indigo-300"
            borderColorClass="border-indigo-200 dark:border-indigo-800"
            bgClass="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900"
          />

          <StandardCard
            icon={<Users className="h-4 w-4 text-rose-600" />}
            title="Clientes Atacado"
            value={clientMetrics.clientesAtacado}
            subtitle="Total clientes - ADVECs"
            colorClass="text-rose-700 dark:text-rose-300"
            borderColorClass="border-rose-200 dark:border-rose-800"
            bgClass="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900"
          />
        </div>
      </CardContent>
    </Card>
  );
}
