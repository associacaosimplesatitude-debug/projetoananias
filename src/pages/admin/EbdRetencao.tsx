import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RetencaoKanban, type KanbanCliente } from "@/components/admin/retencao/RetencaoKanban";
import { useUserRole } from "@/hooks/useUserRole";
import { useVendedor } from "@/hooks/useVendedor";
import { Shield, AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";

interface RetencaoDashboard {
  faixas: { verde: number; amarelo: number; vermelho: number; perdido: number; fechados: number };
  kanban_clientes: KanbanCliente[];
}

export default function EbdRetencao() {
  const { isAdmin } = useUserRole();
  const { vendedor } = useVendedor();
  const [filtroVendedor, setFiltroVendedor] = useState<string>("");
  const [filtroCanal, setFiltroCanal] = useState<string>("");

  // For non-admin, use their vendedor_id
  const vendedorIdParam = isAdmin ? (filtroVendedor || null) : vendedor?.id || null;

  const { data, isLoading } = useQuery<RetencaoDashboard>({
    queryKey: ["retencao-dashboard", vendedorIdParam],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_retencao_dashboard", {
        p_vendedor_id: vendedorIdParam,
      });
      if (error) throw error;
      return data as unknown as RetencaoDashboard;
    },
  });

  // Load vendedores for filter (admin only)
  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendedores")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome");
      return data || [];
    },
    enabled: isAdmin,
  });

  const faixas = data?.faixas || { verde: 0, amarelo: 0, vermelho: 0, perdido: 0, fechados: 0 };

  const cards = [
    { label: "Ativos (0-30d)", value: faixas.verde, icon: Shield, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Atenção (30-60d)", value: faixas.amarelo, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
    { label: "Crítico (60-90d)", value: faixas.vermelho, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
    { label: "Urgente (90+d)", value: faixas.perdido, icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/40" },
    { label: "Fechados (mês atual)", value: faixas.fechados, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🔄 Retenção de Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe clientes por tempo desde a última compra e registre contatos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className={c.bg}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`h-8 w-8 ${c.color}`} />
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isAdmin && (
          <Select value={filtroVendedor} onValueChange={v => setFiltroVendedor(v === "todos" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores?.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filtroCanal} onValueChange={v => setFiltroCanal(v === "todos" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            <SelectItem value="E-commerce">E-commerce</SelectItem>
            <SelectItem value="Mercado Pago">Mercado Pago</SelectItem>
            <SelectItem value="Faturado">Faturado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <RetencaoKanban
          clientes={data?.kanban_clientes || []}
          filtroVendedor={filtroVendedor}
          filtroCanal={filtroCanal}
        />
      )}
    </div>
  );
}
