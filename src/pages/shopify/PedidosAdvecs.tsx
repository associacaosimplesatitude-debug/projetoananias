import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RefreshCw, Search, Church, CalendarIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MarketplacePedido {
  id: string;
  bling_order_id: number;
  marketplace: string;
  order_number: string;
  order_date: string | null;
  customer_name: string | null;
  customer_email: string | null;
  valor_total: number;
  valor_frete: number;
  status_pagamento: string;
  status_logistico: string | null;
  codigo_rastreio: string | null;
  created_at: string;
}

type DateFilter = "all" | "last_7_days" | "last_month" | "custom";

export default function PedidosAdvecs() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["marketplace-pedidos-advecs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bling_marketplace_pedidos")
        .select("*")
        .eq("marketplace", "ADVECS")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data as MarketplacePedido[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("bling-sync-marketplace-orders", {
        body: { marketplace: "ADVECS" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-pedidos-advecs"] });
      toast.success(`Sincronizado! ${data.syncedCount || 0} pedidos ADVECS.`);
    },
    onError: (error: any) => {
      toast.error("Erro ao sincronizar: " + error.message);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-atacado-csv`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao importar CSV");
      }

      queryClient.invalidateQueries({ queryKey: ["marketplace-pedidos-atacado"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-pedidos-advecs"] });
      toast.success(`${result.message} (ADVECS: ${result.advecs}, ATACADO: ${result.atacado})`);
    } catch (error: any) {
      toast.error("Erro ao importar: " + error.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const filteredByDate = useMemo(() => {
    if (!pedidos) return [];
    const now = new Date();

    switch (dateFilter) {
      case "last_7_days": {
        const sevenDaysAgo = subDays(now, 7);
        return pedidos.filter((p) => {
          if (!p.order_date) return false;
          return new Date(p.order_date) >= sevenDaysAgo;
        });
      }
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        return pedidos.filter((p) => {
          if (!p.order_date) return false;
          const date = new Date(p.order_date);
          return isWithinInterval(date, { start, end });
        });
      }
      case "custom": {
        if (!customDateRange.from) return pedidos;
        const start = customDateRange.from;
        const end = customDateRange.to || customDateRange.from;
        return pedidos.filter((p) => {
          if (!p.order_date) return false;
          const date = new Date(p.order_date);
          return isWithinInterval(date, { start, end: new Date(end.getTime() + 86400000 - 1) });
        });
      }
      default:
        return pedidos;
    }
  }, [pedidos, dateFilter, customDateRange]);

  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return filteredByDate;
    const term = searchTerm.toLowerCase();
    return filteredByDate.filter(
      (p) =>
        p.order_number.toLowerCase().includes(term) ||
        p.customer_name?.toLowerCase().includes(term) ||
        p.customer_email?.toLowerCase().includes(term)
    );
  }, [filteredByDate, searchTerm]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("pago") || statusLower.includes("atendido")) {
      return <Badge className="bg-green-100 text-green-800">{status}</Badge>;
    }
    if (statusLower.includes("cancelado")) {
      return <Badge variant="destructive">{status}</Badge>;
    }
    if (statusLower.includes("pendente") || statusLower.includes("aberto")) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700">{status}</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const totalValor = filteredPedidos.reduce((sum, p) => sum + Number(p.valor_total), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Church className="h-6 w-6 text-blue-600" />
            Pedidos ADVECS
          </h1>
          <p className="text-muted-foreground">Pedidos das Assembleias de Deus Vitória em Cristo</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className={cn("h-4 w-4 mr-2", isImporting && "animate-pulse")} />
            {isImporting ? "Importando..." : "Importar CSV"}
          </Button>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
            Sincronizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { value: "all", label: "Todos" },
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
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
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
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="outline" className="text-sm">
              {filteredPedidos.length} pedidos
            </Badge>
            <Badge className="bg-blue-100 text-blue-800">
              Total: {formatCurrency(totalValor)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredPedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pedido encontrado. Clique em "Sincronizar" para buscar pedidos do Bling.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rastreio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPedidos.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">#{pedido.order_number}</TableCell>
                      <TableCell>{formatDate(pedido.order_date)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{pedido.customer_name || "-"}</p>
                          <p className="text-xs text-muted-foreground">{pedido.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(pedido.valor_total)}</TableCell>
                      <TableCell>{getStatusBadge(pedido.status_pagamento)}</TableCell>
                      <TableCell>
                        {pedido.codigo_rastreio ? (
                          <span className="text-sm font-mono">{pedido.codigo_rastreio}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
