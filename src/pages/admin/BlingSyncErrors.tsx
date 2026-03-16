import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SyncErrorRow {
  id: string;
  cliente_nome: string | null;
  cliente_email: string | null;
  valor_total: number | null;
  created_at: string;
  sync_retries: number | null;
  sync_error: string | null;
  bling_order_id: number | null;
}

export default function BlingSyncErrors() {
  const queryClient = useQueryClient();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["bling-sync-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_mercadopago")
        .select("id, cliente_nome, cliente_email, valor_total, created_at, sync_retries, sync_error, bling_order_id")
        .eq("status", "PAGO")
        .is("bling_order_id", null)
        .gte("created_at", "2026-01-01T00:00:00.000Z")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SyncErrorRow[];
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (pedidoId: string) => {
      setResendingId(pedidoId);
      const { data, error } = await supabase.functions.invoke("mp-sync-orphan-order", {
        body: { pedido_id: pedidoId },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro desconhecido");
      return data;
    },
    onSuccess: (data) => {
      if (data?.bling_order_id) {
        toast.success(`Pedido sincronizado com Bling! ID: ${data.bling_order_id}`);
      } else {
        toast.success("Reenvio concluído");
      }
      queryClient.invalidateQueries({ queryKey: ["bling-sync-errors"] });
    },
    onError: (error: Error) => {
      toast.error(`Falha ao reenviar: ${error.message}`);
      queryClient.invalidateQueries({ queryKey: ["bling-sync-errors"] });
    },
    onSettled: () => {
      setResendingId(null);
    },
  });

  const formatCurrency = (value: number | null) =>
    value != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
      : "—";

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold">Pedidos Pendentes de Sincronização Bling</h1>
          <p className="text-muted-foreground text-sm">
            Pedidos Mercado Pago pagos que ainda não foram sincronizados com o Bling
          </p>
        </div>
        <Badge variant="destructive" className="ml-auto text-sm">
          {errors.length} pendente{errors.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pedidos com erro</CardTitle>
          <CardDescription>
            Clique em "Reenviar" para tentar sincronizar novamente com o Bling
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : errors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium">Nenhum erro de sincronização!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead className="max-w-[300px]">Erro</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.id.slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.cliente_nome || "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.cliente_email || ""}</div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(row.valor_total)}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.sync_retries ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="flex items-start gap-1.5">
                          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <span className="text-xs text-destructive line-clamp-3">
                            {row.sync_error}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={resendingId === row.id}
                          onClick={() => resendMutation.mutate(row.id)}
                        >
                          <RefreshCw className={`h-4 w-4 ${resendingId === row.id ? "animate-spin" : ""}`} />
                          Reenviar
                        </Button>
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
