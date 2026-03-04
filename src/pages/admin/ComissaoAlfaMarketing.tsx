import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, DollarSign, CheckCircle2, Clock, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

const COMMISSION_RATE = 0.03;

interface ChannelTotals {
  ecommerce: { valor: number; qtd: number };
  igreja_cnpj: { valor: number; qtd: number };
  igreja_cpf: { valor: number; qtd: number };
  lojistas: { valor: number; qtd: number };
  pessoa_fisica: { valor: number; qtd: number };
  igrejas_total: { valor: number; qtd: number };
  advecs: { valor: number; qtd: number };
  atacado: { valor: number; qtd: number };
  propostas_advecs: { valor: number; qtd: number };
  propostas_revendedores: { valor: number; qtd: number };
  propostas_representantes: { valor: number; qtd: number };
  pdv_balcao: { valor: number; qtd: number };
}

const CHANNEL_CONFIG: { key: string; label: string; rpcKey: keyof ChannelTotals }[] = [
  { key: "b2b_faturado", label: "B2B Faturado (Igrejas Total)", rpcKey: "igrejas_total" },
  { key: "ecommerce_cg", label: "E-commerce (Central Gospel)", rpcKey: "ecommerce" },
  { key: "pdv_balcao", label: "PDV Balcão", rpcKey: "pdv_balcao" },
  { key: "advecs", label: "ADVECS", rpcKey: "advecs" },
  { key: "atacado", label: "Atacado", rpcKey: "atacado" },
  { key: "igreja_cnpj", label: "Igreja CNPJ", rpcKey: "igreja_cnpj" },
  { key: "igreja_cpf", label: "Igreja CPF", rpcKey: "igreja_cpf" },
  { key: "lojistas", label: "Lojistas", rpcKey: "lojistas" },
  { key: "pessoa_fisica", label: "Pessoa Física", rpcKey: "pessoa_fisica" },
  { key: "revendedores", label: "Revendedores", rpcKey: "propostas_revendedores" },
  { key: "representantes", label: "Representantes", rpcKey: "propostas_representantes" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface OrderDetail {
  cliente: string;
  tipo: string;
  data: string;
  valor: number;
  comissao: number;
  status: string;
  nf_numero?: string;
  nf_url?: string;
}

interface VendaHoje {
  vendedor: string;
  canal: string;
  cliente: string;
  valor: number;
  comissao: number;
}

export default function ComissaoAlfaMarketing() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const startDate = startOfMonth(currentDate).toISOString();
  const endDate = endOfMonth(currentDate).toISOString();

  // Fetch channel totals via RPC (same as main dashboard)
  const { data: channelTotals, isLoading } = useQuery({
    queryKey: ["alfamarketing-rpc", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_channel_totals", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return data as unknown as ChannelTotals;
    },
  });

  // Build channel data from RPC results
  const channelData = useMemo(() => {
    if (!channelTotals) return [];
    return CHANNEL_CONFIG.map((cfg) => {
      const rpcData = channelTotals[cfg.rpcKey];
      const valor = Number(rpcData?.valor) || 0;
      return { canal: cfg.key, label: cfg.label, valor_bruto: valor };
    });
  }, [channelTotals]);

  // Fetch saved commission records
  const { data: savedRecords } = useQuery({
    queryKey: ["alfamarketing-saved", startDate],
    queryFn: async () => {
      const mesRef = format(currentDate, "yyyy-MM-01");
      const { data } = await supabase
        .from("comissoes_alfamarketing")
        .select("*")
        .eq("mes_referencia", mesRef);
      return data || [];
    },
  });

  // History
  const { data: history } = useQuery({
    queryKey: ["alfamarketing-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes_alfamarketing")
        .select("*")
        .order("mes_referencia", { ascending: false });
      const grouped: Record<string, { mes: string; valor_bruto: number; valor_comissao: number; status: string; pago_em: string | null }> = {};
      (data || []).forEach((r: any) => {
        const key = r.mes_referencia;
        if (!grouped[key]) {
          grouped[key] = { mes: key, valor_bruto: 0, valor_comissao: 0, status: r.status, pago_em: r.pago_em };
        }
        grouped[key].valor_bruto += Number(r.valor_bruto);
        grouped[key].valor_comissao += Number(r.valor_comissao);
        if (r.status === "pendente") grouped[key].status = "pendente";
        if (grouped[key].status !== "pendente" && r.status === "liberada") grouped[key].status = "liberada";
  });

  // Vendas de Hoje
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = new Date().toISOString();

  const { data: vendasHoje, isLoading: isLoadingHoje } = useQuery({
    queryKey: ["vendas-hoje", todayStart],
    queryFn: async () => {
      // Fetch vendedores map
      const { data: vendedores } = await supabase.from("vendedores").select("id, nome");
      const vendMap: Record<string, string> = {};
      (vendedores || []).forEach((v: any) => { vendMap[v.id] = v.nome; });

      const vendas: VendaHoje[] = [];

      // B2B
      const { data: sp } = await supabase
        .from("ebd_shopify_pedidos")
        .select("customer_name, valor_total, vendedor_id")
        .in("status_pagamento", ["Pago", "paid", "Faturado"])
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      (sp || []).forEach((o: any) => vendas.push({
        vendedor: vendMap[o.vendedor_id] || "—",
        canal: "B2B",
        cliente: o.customer_name || "—",
        valor: o.valor_total || 0,
        comissao: (o.valor_total || 0) * COMMISSION_RATE,
      }));

      // Mercado Pago
      const { data: mp } = await supabase
        .from("ebd_shopify_pedidos_mercadopago")
        .select("cliente_nome, valor_total, vendedor_nome")
        .eq("status", "PAGO")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      (mp || []).forEach((o: any) => vendas.push({
        vendedor: o.vendedor_nome || "—",
        canal: "Mercado Pago",
        cliente: o.cliente_nome || "—",
        valor: o.valor_total || 0,
        comissao: (o.valor_total || 0) * COMMISSION_RATE,
      }));

      // E-commerce CG
      const { data: cg } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("customer_name, valor_total, vendedor_id")
        .in("status_pagamento", ["paid", "Pago", "Faturado"])
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      (cg || []).forEach((o: any) => vendas.push({
        vendedor: vendMap[o.vendedor_id] || "—",
        canal: "E-commerce CG",
        cliente: o.customer_name || "—",
        valor: o.valor_total || 0,
        comissao: (o.valor_total || 0) * COMMISSION_RATE,
      }));

      // Propostas
      const { data: props } = await supabase
        .from("vendedor_propostas")
        .select("cliente_nome, valor_total, valor_frete, vendedor_nome")
        .in("status", ["FATURADO", "PAGO"])
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      (props || []).forEach((o: any) => {
        const val = (o.valor_total || 0) - (o.valor_frete || 0);
        vendas.push({
          vendedor: o.vendedor_nome || "—",
          canal: "Proposta B2B",
          cliente: o.cliente_nome || "—",
          valor: val,
          comissao: val * COMMISSION_RATE,
        });
      });

      // PDV Balcão
      const { data: pdv } = await supabase
        .from("vendas_balcao")
        .select("cliente_nome, valor_total, vendedor_id")
        .eq("status", "finalizada")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      (pdv || []).forEach((o: any) => vendas.push({
        vendedor: vendMap[o.vendedor_id] || "—",
        canal: "PDV Balcão",
        cliente: o.cliente_nome || "Balcão",
        valor: o.valor_total || 0,
        comissao: (o.valor_total || 0) * COMMISSION_RATE,
      }));

      // Marketplaces
      const { data: bl } = await supabase
        .from("bling_marketplace_pedidos")
        .select("customer_name, valor_total, marketplace")
        .gte("order_date", todayStart)
        .lte("order_date", todayEnd);
      (bl || []).forEach((o: any) => vendas.push({
        vendedor: "—",
        canal: o.marketplace || "Marketplace",
        cliente: o.customer_name || "—",
        valor: o.valor_total || 0,
        comissao: (o.valor_total || 0) * COMMISSION_RATE,
      }));

      return vendas;
    },
    refetchInterval: 60000, // refresh every minute
  });
      return Object.values(grouped);
    },
  });

  // Drill-down: fetch orders for selected channel
  const { data: orderDetails, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["alfamarketing-orders", selectedChannel, startDate, endDate],
    enabled: !!selectedChannel,
    queryFn: async () => {
      if (!selectedChannel) return [];
      const orders: OrderDetail[] = [];

      const fetchShopifyByTipo = async (tipoFilter: string) => {
        const { data: sp } = await supabase
          .from("ebd_shopify_pedidos")
          .select("customer_name, valor_total, created_at, status_pagamento, cliente_id, nota_fiscal_numero, nota_fiscal_url, status_nfe")
          .in("status_pagamento", ["Pago", "paid", "Faturado"])
          .gte("created_at", startDate)
          .lte("created_at", endDate);
        if (sp) {
          for (const o of sp) {
            if (o.cliente_id) {
              const { data: cl } = await supabase
                .from("ebd_clientes")
                .select("tipo_cliente, nome_igreja")
                .eq("id", o.cliente_id)
                .single();
              if (cl && (cl.tipo_cliente || "").toUpperCase().includes(tipoFilter)) {
                orders.push({
                  cliente: cl.nome_igreja || o.customer_name || "—",
                  tipo: cl.tipo_cliente || "—",
                  data: o.created_at,
                  valor: o.valor_total || 0,
                  comissao: (o.valor_total || 0) * COMMISSION_RATE,
                  status: o.status_pagamento || "—",
                  nf_numero: o.nota_fiscal_numero || undefined,
                  nf_url: o.nota_fiscal_url || undefined,
                });
              }
            }
          }
        }
        // Also MP
        const { data: mp } = await supabase
          .from("ebd_shopify_pedidos_mercadopago")
          .select("cliente_nome, valor_total, created_at, status, cliente_id")
          .eq("status", "PAGO")
          .gte("created_at", startDate)
          .lte("created_at", endDate);
        if (mp) {
          for (const o of mp) {
            if (o.cliente_id) {
              const { data: cl } = await supabase
                .from("ebd_clientes")
                .select("tipo_cliente, nome_igreja")
                .eq("id", o.cliente_id)
                .single();
              if (cl && (cl.tipo_cliente || "").toUpperCase().includes(tipoFilter)) {
                orders.push({
                  cliente: cl.nome_igreja || o.cliente_nome || "—",
                  tipo: cl.tipo_cliente || "—",
                  data: o.created_at,
                  valor: o.valor_total || 0,
                  comissao: (o.valor_total || 0) * COMMISSION_RATE,
                  status: o.status || "—",
                });
              }
            }
          }
        }
      };

      const fetchPropostasByTipo = async (tipoFilter: string) => {
        const { data: props } = await supabase
          .from("vendedor_propostas")
          .select("cliente_nome, cliente_id, valor_total, valor_frete, created_at, status, link_danfe")
          .in("status", ["FATURADO", "PAGO"])
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .limit(500);
        if (props) {
          for (const p of props) {
            if (p.cliente_id) {
              const { data: cl } = await supabase
                .from("ebd_clientes")
                .select("tipo_cliente, nome_igreja")
                .eq("id", p.cliente_id)
                .single();
              if (cl && (cl.tipo_cliente || "").toUpperCase().includes(tipoFilter)) {
                const valor = (p.valor_total || 0) - (p.valor_frete || 0);
                orders.push({
                  cliente: cl.nome_igreja || p.cliente_nome || "—",
                  tipo: cl.tipo_cliente || "—",
                  data: p.created_at,
                  valor,
                  comissao: valor * COMMISSION_RATE,
                  status: p.status || "—",
                  nf_url: p.link_danfe || undefined,
                });
              }
            }
          }
        }
      };

      switch (selectedChannel) {
        case "b2b_faturado": {
          const { data: sp } = await supabase
            .from("ebd_shopify_pedidos")
            .select("customer_name, valor_total, created_at, status_pagamento, nota_fiscal_numero, nota_fiscal_url")
            .in("status_pagamento", ["Pago", "paid", "Faturado"])
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .limit(500);
          (sp || []).forEach((o) => orders.push({
            cliente: o.customer_name || "—", tipo: "B2B", data: o.created_at,
            valor: o.valor_total || 0, comissao: (o.valor_total || 0) * COMMISSION_RATE,
            status: o.status_pagamento || "—",
            nf_numero: o.nota_fiscal_numero || undefined,
            nf_url: o.nota_fiscal_url || undefined,
          }));
          const { data: mp } = await supabase
            .from("ebd_shopify_pedidos_mercadopago")
            .select("cliente_nome, valor_total, created_at, status")
            .eq("status", "PAGO")
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .limit(500);
          (mp || []).forEach((o) => orders.push({
            cliente: o.cliente_nome || "—", tipo: "Mercado Pago", data: o.created_at,
            valor: o.valor_total || 0, comissao: (o.valor_total || 0) * COMMISSION_RATE,
            status: o.status || "—",
          }));
          break;
        }
        case "ecommerce_cg": {
          const { data: cg } = await supabase
            .from("ebd_shopify_pedidos_cg")
            .select("customer_name, valor_total, created_at, status_pagamento")
            .in("status_pagamento", ["paid", "Pago", "Faturado"])
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .limit(500);
          (cg || []).forEach((o) => orders.push({
            cliente: o.customer_name || "—", tipo: "E-commerce CG", data: o.created_at,
            valor: o.valor_total || 0, comissao: (o.valor_total || 0) * COMMISSION_RATE,
            status: o.status_pagamento || "—",
          }));
          break;
        }
        case "pdv_balcao": {
          const { data: pdv } = await supabase
            .from("vendas_balcao")
            .select("cliente_nome, valor_total, created_at, status")
            .eq("status", "finalizada")
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .limit(500);
          (pdv || []).forEach((o: any) => orders.push({
            cliente: o.cliente_nome || "Balcão", tipo: "PDV", data: o.created_at,
            valor: o.valor_total || 0, comissao: (o.valor_total || 0) * COMMISSION_RATE,
            status: o.status || "—",
          }));
          break;
        }
        case "advecs": {
          const { data: bl } = await supabase
            .from("bling_marketplace_pedidos")
            .select("customer_name, valor_total, order_date, status_pagamento")
            .eq("marketplace", "ADVECS")
            .gte("order_date", startDate)
            .lte("order_date", endDate)
            .limit(500);
          (bl || []).forEach((o) => orders.push({
            cliente: o.customer_name || "—", tipo: "ADVECS Bling", data: o.order_date || "",
            valor: o.valor_total || 0, comissao: (o.valor_total || 0) * COMMISSION_RATE,
            status: o.status_pagamento || "—",
          }));
          await fetchShopifyByTipo("ADVEC");
          break;
        }
        case "atacado": {
          const { data: bl } = await supabase
            .from("bling_marketplace_pedidos")
            .select("customer_name, valor_total, order_date, status_pagamento")
            .eq("marketplace", "ATACADO")
            .gte("order_date", startDate)
            .lte("order_date", endDate)
            .limit(500);
          (bl || []).forEach((o) => orders.push({
            cliente: o.customer_name || "—", tipo: "Atacado", data: o.order_date || "",
            valor: o.valor_total || 0, comissao: (o.valor_total || 0) * COMMISSION_RATE,
            status: o.status_pagamento || "—",
          }));
          break;
        }
        case "igreja_cnpj":
          await fetchShopifyByTipo("IGREJA");
          const cnpjOnly = orders.filter(o => o.tipo.toUpperCase().includes("CNPJ"));
          orders.length = 0;
          orders.push(...cnpjOnly);
          break;
        case "igreja_cpf":
          await fetchShopifyByTipo("IGREJA");
          const cpfOnly = orders.filter(o => o.tipo.toUpperCase().includes("CPF"));
          orders.length = 0;
          orders.push(...cpfOnly);
          break;
        case "lojistas":
          await fetchShopifyByTipo("LOJISTA");
          break;
        case "pessoa_fisica":
          await fetchShopifyByTipo("PESSOA");
          await fetchShopifyByTipo("FISICA");
          await fetchShopifyByTipo("PF");
          // deduplicate by cliente+data+valor
          const seen = new Set<string>();
          const unique: OrderDetail[] = [];
          for (const o of orders) {
            const key = `${o.cliente}|${o.data}|${o.valor}`;
            if (!seen.has(key)) { seen.add(key); unique.push(o); }
          }
          orders.length = 0;
          orders.push(...unique);
          break;
        case "revendedores":
          await fetchShopifyByTipo("REVENDEDOR");
          await fetchPropostasByTipo("REVENDEDOR");
          break;
        case "representantes":
          await fetchShopifyByTipo("REPRESENTANTE");
          await fetchPropostasByTipo("REPRESENTANTE");
          break;
      }

      return orders.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    },
  });

  const totalBruto = useMemo(() => channelData.reduce((s, c) => s + c.valor_bruto, 0), [channelData]);
  const totalComissao = totalBruto * COMMISSION_RATE;

  const currentMonthStatus = useMemo(() => {
    if (!savedRecords || savedRecords.length === 0) return "nao_salvo";
    const statuses = savedRecords.map((r: any) => r.status);
    if (statuses.every((s: string) => s === "paga")) return "paga";
    if (statuses.some((s: string) => s === "pendente")) return "pendente";
    return "liberada";
  }, [savedRecords]);

  const currentMonthPagoEm = useMemo(() => {
    if (!savedRecords || savedRecords.length === 0) return null;
    const paid = savedRecords.find((r: any) => r.pago_em);
    return paid ? (paid as any).pago_em : null;
  }, [savedRecords]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const mesRef = format(currentDate, "yyyy-MM-01");
      for (const ch of channelData) {
        const comissao = ch.valor_bruto * COMMISSION_RATE;
        await supabase.from("comissoes_alfamarketing").upsert({
          mes_referencia: mesRef,
          canal: ch.canal,
          valor_bruto: ch.valor_bruto,
          valor_comissao: comissao,
          status: "liberada",
          updated_at: new Date().toISOString(),
        }, { onConflict: "mes_referencia,canal" });
      }
    },
    onSuccess: () => {
      toast.success("Comissão salva como liberada");
      queryClient.invalidateQueries({ queryKey: ["alfamarketing-saved"] });
      queryClient.invalidateQueries({ queryKey: ["alfamarketing-history"] });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (mesRef: string) => {
      await supabase
        .from("comissoes_alfamarketing")
        .update({ status: "paga", pago_em: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("mes_referencia", mesRef);
    },
    onSuccess: () => {
      toast.success("Comissão marcada como paga");
      queryClient.invalidateQueries({ queryKey: ["alfamarketing-saved"] });
      queryClient.invalidateQueries({ queryKey: ["alfamarketing-history"] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paga": return <Badge className="bg-primary text-primary-foreground">Paga</Badge>;
      case "liberada": return <Badge className="bg-accent text-accent-foreground">Liberada</Badge>;
      case "pendente": return <Badge variant="secondary">Pendente</Badge>;
      default: return <Badge variant="outline">—</Badge>;
    }
  };

  const selectedLabel = CHANNEL_CONFIG.find(c => c.key === selectedChannel)?.label || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comissão AlfaMarketing</h1>
          <p className="text-muted-foreground">3% sobre o faturamento bruto de todos os canais</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[140px] text-center capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Total Card */}
      <Card className="border-2 border-primary bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Vendas do Mês</p>
                <p className="text-3xl font-extrabold">{formatCurrency(totalBruto)}</p>
              </div>
            </div>
            <div className="border-l-2 border-primary/30 pl-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Comissão AlfaMarketing (3%)</p>
              <p className="text-3xl font-extrabold text-primary">{formatCurrency(totalComissao)}</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(currentMonthStatus)}
              {currentMonthStatus === "nao_salvo" && (
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || totalBruto === 0}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar & Liberar"}
                </Button>
              )}
              {currentMonthStatus === "liberada" && (
                <Button size="sm" variant="default" onClick={() => payMutation.mutate(format(currentDate, "yyyy-MM-01"))} disabled={payMutation.isPending}>
                  {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Marcar Paga</>}
                </Button>
              )}
              {currentMonthPagoEm && (
                <span className="text-xs text-muted-foreground">
                  Pago em {format(new Date(currentMonthPagoEm), "dd/MM/yyyy")}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Cards Grid */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {channelData.map((ch) => (
            <Card
              key={ch.canal}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedChannel(ch.canal)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{ch.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{formatCurrency(ch.valor_bruto)}</p>
                <p className="text-sm text-primary font-medium">{formatCurrency(ch.valor_bruto * COMMISSION_RATE)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Drill-down Dialog */}
      <Dialog open={!!selectedChannel} onOpenChange={(open) => !open && setSelectedChannel(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedidos — {selectedLabel}</DialogTitle>
          </DialogHeader>
          {isLoadingOrders ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Comissão (3%)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>NF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!orderDetails || orderDetails.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</TableCell>
                  </TableRow>
                ) : (
                  orderDetails.map((o, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[200px] truncate">{o.cliente}</TableCell>
                      <TableCell>{o.tipo}</TableCell>
                      <TableCell>{o.data ? format(new Date(o.data), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(o.valor)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(o.comissao)}</TableCell>
                      <TableCell>{o.status}</TableCell>
                      <TableCell>
                        {o.nf_url ? (
                          <a href={o.nf_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                            {o.nf_numero || "Ver NF"}
                          </a>
                        ) : o.nf_numero ? (
                          <span className="text-xs">{o.nf_numero}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês Referência</TableHead>
                <TableHead className="text-right">Valor Bruto</TableHead>
                <TableHead className="text-right">Comissão (3%)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Pagamento</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma comissão salva ainda
                  </TableCell>
                </TableRow>
              ) : (
                (history || []).map((h) => (
                  <TableRow key={h.mes}>
                    <TableCell className="capitalize">
                      {format(new Date(h.mes + "T12:00:00"), "MMMM yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(h.valor_bruto)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(h.valor_comissao)}</TableCell>
                    <TableCell>{getStatusBadge(h.status)}</TableCell>
                    <TableCell>
                      {h.pago_em ? format(new Date(h.pago_em), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {h.status === "liberada" && (
                        <Button size="sm" variant="outline" onClick={() => payMutation.mutate(h.mes)} disabled={payMutation.isPending}>
                          Marcar Paga
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendas de Hoje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Vendas de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHoje ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <Badge variant="outline" className="text-sm">
                  {(vendasHoje || []).length} venda{(vendasHoje || []).length !== 1 ? "s" : ""}
                </Badge>
                <span className="text-sm font-medium">
                  Total: {formatCurrency((vendasHoje || []).reduce((s, v) => s + v.valor, 0))}
                </span>
                <span className="text-sm text-primary font-medium">
                  Comissão: {formatCurrency((vendasHoje || []).reduce((s, v) => s + v.comissao, 0))}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Comissão (3%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vendasHoje || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma venda registrada hoje
                      </TableCell>
                    </TableRow>
                  ) : (
                    (vendasHoje || []).map((v, i) => (
                      <TableRow key={i}>
                        <TableCell>{v.vendedor}</TableCell>
                        <TableCell><Badge variant="outline">{v.canal}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{v.cliente}</TableCell>
                        <TableCell className="text-right">{formatCurrency(v.valor)}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{formatCurrency(v.comissao)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
