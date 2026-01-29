import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AutorExtrato() {
  const { autorId } = useRoyaltiesAuth();

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["autor-extrato", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      // First get the author's books
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      if (!livros || livros.length === 0) return [];

      const livroIds = livros.map((l) => l.id);

      // Then get sales for those books
      const { data, error } = await supabase
        .from("royalties_vendas")
        .select(`
          *,
          royalties_livros (titulo)
        `)
        .in("livro_id", livroIds)
        .order("data_venda", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!autorId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalComissao = vendas.reduce(
    (acc, v) => acc + Number(v.valor_comissao_total || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Extrato de Vendas</h1>
        <p className="text-muted-foreground">
          Acompanhe todas as vendas dos seus livros
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
          <CardDescription>
            Total de comissões: {formatCurrency(totalComissao)}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>
            {vendas.length} vendas registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
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
                    <TableCell className="text-right">{venda.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(venda.valor_comissao_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={venda.pagamento_id ? "default" : "secondary"}>
                        {venda.pagamento_id ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
