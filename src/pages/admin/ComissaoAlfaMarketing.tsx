import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, DollarSign, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

const COMMISSION_RATE = 0.03;

interface ChannelData {
  canal: string;
  label: string;
  valor_bruto: number;
}

const CHANNEL_CONFIG: { key: string; label: string }[] = [
  { key: "b2b_faturado", label: "B2B Faturado (Shopify Draft)" },
  { key: "mercado_pago", label: "Mercado Pago" },
  { key: "ecommerce_cg", label: "E-commerce (Central Gospel)" },
  { key: "propostas", label: "Propostas Vendedores" },
  { key: "pdv_balcao", label: "PDV Balcão" },
  { key: "advecs", label: "ADVECS" },
  { key: "atacado", label: "Atacado" },
  { key: "amazon", label: "Amazon" },
  { key: "shopee", label: "Shopee" },
  { key: "mercado_livre", label: "Mercado Livre" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ComissaoAlfaMarketing() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));

  const startDate = startOfMonth(currentDate).toISOString();
  const endDate = endOfMonth(currentDate).toISOString();

  // Fetch live channel data
  const { data: channelData, isLoading } = useQuery({
    queryKey: ["alfamarketing-channels", startDate, endDate],
    queryFn: async () => {
      const results: ChannelData[] = [];

      // B2B Faturado
      const { data: b2b } = await supabase
        .from("ebd_shopify_pedidos")
        .select("valor_total")
        .in("status_pagamento", ["Pago", "paid", "Faturado"])
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      results.push({ canal: "b2b_faturado", label: "B2B Faturado", valor_bruto: (b2b || []).reduce((s, r) => s + (r.valor_total || 0), 0) });

      // Mercado Pago
      const { data: mp } = await supabase
        .from("ebd_shopify_pedidos_mercadopago")
        .select("valor_total")
        .eq("status", "PAGO")
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      results.push({ canal: "mercado_pago", label: "Mercado Pago", valor_bruto: (mp || []).reduce((s, r) => s + (r.valor_total || 0), 0) });

      // E-commerce CG
      const { data: cg } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("valor_total")
        .in("status_pagamento", ["paid", "Pago", "Faturado"])
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      results.push({ canal: "ecommerce_cg", label: "E-commerce CG", valor_bruto: (cg || []).reduce((s, r) => s + (r.valor_total || 0), 0) });

      // Propostas Vendedores
      const { data: prop } = await supabase
        .from("vendedor_propostas")
        .select("valor_total")
        .in("status", ["FATURADO", "PAGO"])
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      results.push({ canal: "propostas", label: "Propostas", valor_bruto: (prop || []).reduce((s, r) => s + (r.valor_total || 0), 0) });

      // PDV Balcão
      const { data: pdv } = await supabase
        .from("vendas_balcao")
        .select("valor_total")
        .eq("status", "finalizada")
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      results.push({ canal: "pdv_balcao", label: "PDV Balcão", valor_bruto: (pdv || []).reduce((s, r) => s + (r.valor_total || 0), 0) });

      // Marketplaces via bling
      const marketplaces = [
        { key: "advecs", filter: "ADVECS", label: "ADVECS" },
        { key: "atacado", filter: "ATACADO", label: "Atacado" },
        { key: "amazon", filter: "AMAZON", label: "Amazon" },
        { key: "shopee", filter: "SHOPEE", label: "Shopee" },
        { key: "mercado_livre", filter: "MERCADO_LIVRE", label: "Mercado Livre" },
      ];

      for (const m of marketplaces) {
        const { data: mkt } = await supabase
          .from("bling_marketplace_pedidos")
          .select("valor_total")
          .eq("marketplace", m.filter)
          .gte("order_date", startDate)
          .lte("order_date", endDate);
        results.push({ canal: m.key, label: m.label, valor_bruto: (mkt || []).reduce((s, r) => s + (r.valor_total || 0), 0) });
      }

      return results;
    },
  });

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
      
      // Group by mes_referencia
      const grouped: Record<string, { mes: string; valor_bruto: number; valor_comissao: number; status: string; pago_em: string | null }> = {};
      (data || []).forEach((r: any) => {
        const key = r.mes_referencia;
        if (!grouped[key]) {
          grouped[key] = { mes: key, valor_bruto: 0, valor_comissao: 0, status: r.status, pago_em: r.pago_em };
        }
        grouped[key].valor_bruto += Number(r.valor_bruto);
        grouped[key].valor_comissao += Number(r.valor_comissao);
        // Status: if any is pendente, overall is pendente; if all paga, overall paga
        if (r.status === "pendente") grouped[key].status = "pendente";
        if (grouped[key].status !== "pendente" && r.status === "liberada") grouped[key].status = "liberada";
      });
      return Object.values(grouped);
    },
  });

  const totalBruto = useMemo(() => (channelData || []).reduce((s, c) => s + c.valor_bruto, 0), [channelData]);
  const totalComissao = totalBruto * COMMISSION_RATE;

  // Get status for current month from saved records
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

  // Save/update commission records for current month
  const saveMutation = useMutation({
    mutationFn: async () => {
      const mesRef = format(currentDate, "yyyy-MM-01");
      for (const ch of channelData || []) {
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

  // Mark as paid
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
      case "paga": return <Badge className="bg-green-600">Paga</Badge>;
      case "liberada": return <Badge className="bg-blue-600">Liberada</Badge>;
      case "pendente": return <Badge variant="secondary">Pendente</Badge>;
      default: return <Badge variant="outline">—</Badge>;
    }
  };

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
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Total do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBruto)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Comissão (3%)</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalComissao)}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {(channelData || []).map((ch) => {
            const cfg = CHANNEL_CONFIG.find((c) => c.key === ch.canal);
            return (
              <Card key={ch.canal}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{cfg?.label || ch.canal}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">{formatCurrency(ch.valor_bruto)}</p>
                  <p className="text-sm text-primary font-medium">{formatCurrency(ch.valor_bruto * COMMISSION_RATE)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
    </div>
  );
}
