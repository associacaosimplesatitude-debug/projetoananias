import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ExternalLink, RefreshCw, Database } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VendaDialog } from "@/components/royalties/VendaDialog";
import { BlingSyncButton } from "@/components/royalties/BlingSyncButton";
import { VendasSummaryCards } from "@/components/royalties/VendasSummaryCards";
import { RecalcularComissoesButton } from "@/components/royalties/RecalcularComissoesButton";
import { toast } from "sonner";

export default function RoyaltiesVendas() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["royalties-vendas", search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_vendas")
        .select(`
          *,
          royalties_livros (
            titulo,
            royalties_autores (nome_completo)
          )
        `)
        .order("data_venda", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
  };

  const backfillSkusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backfill-royalties-bling-skus");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
      toast.success(data.message || "SKUs preenchidos com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao preencher SKUs: ${error.message}`);
    },
  });

  const syncNfLinksMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-royalties-nfe-links");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
      toast.success(data.message || "Links de NF atualizados com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao sincronizar NFs: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">
            Registre e acompanhe as vendas de livros
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => backfillSkusMutation.mutate()}
            disabled={backfillSkusMutation.isPending}
          >
            <Database className={`mr-2 h-4 w-4 ${backfillSkusMutation.isPending ? "animate-spin" : ""}`} />
            {backfillSkusMutation.isPending ? "Preenchendo..." : "Preencher SKUs"}
          </Button>
          <RecalcularComissoesButton />
          <Button
            variant="outline"
            onClick={() => syncNfLinksMutation.mutate()}
            disabled={syncNfLinksMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncNfLinksMutation.isPending ? "animate-spin" : ""}`} />
            {syncNfLinksMutation.isPending ? "Atualizando..." : "Atualizar NFs"}
          </Button>
          <BlingSyncButton onSyncComplete={handleSyncComplete} />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Venda Manual
          </Button>
        </div>
      </div>

      <VendasSummaryCards vendas={vendas} />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>
            {vendas.length} vendas registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : vendas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Livro</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda: any) => (
                  <TableRow key={venda.id}>
                    <TableCell>
                      {format(new Date(venda.data_venda), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {venda.royalties_livros?.titulo || "-"}
                    </TableCell>
                    <TableCell>
                      {venda.royalties_livros?.royalties_autores?.nome_completo || "-"}
                    </TableCell>
                    <TableCell className="text-right">{venda.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {(venda as any).is_compra_autor 
                        ? <span className="text-muted-foreground" title="Sem royalties - compra do próprio autor">R$ 0,00</span>
                        : formatCurrency(venda.valor_comissao_total)
                      }
                    </TableCell>
                    <TableCell>
                      {venda.nota_fiscal_url ? (
                        <a
                          href={venda.nota_fiscal_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 hover:underline flex items-center gap-1"
                        >
                          NF {venda.nota_fiscal_numero || venda.bling_order_number || ""}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : venda.bling_order_id ? (
                        <span className="text-xs text-amber-600">Aguardando</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {!venda.bling_order_id && (
                          <Badge variant="outline">Manual</Badge>
                        )}
                        {(venda as any).is_compra_autor && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200" title="Sem royalties - compra do próprio autor">
                            Compra Autor
                          </Badge>
                        )}
                        <Badge variant={venda.pagamento_id ? "default" : "secondary"}>
                          {venda.pagamento_id ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VendaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
