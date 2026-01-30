import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Link2,
  MousePointer,
  ShoppingCart,
  TrendingUp,
  Copy,
  ExternalLink,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AffiliateStats {
  id: string;
  slug: string;
  codigo_afiliado: string;
  link_externo: string;
  comissao_percentual: number;
  is_active: boolean;
  created_at: string;
  livro: { titulo: string; valor_capa: number };
  autor: { nome_completo: string };
  clicks_count: number;
  sales_count: number;
  total_sales_value: number;
  total_commission: number;
}

export default function Afiliados() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: affiliateLinks, isLoading } = useQuery({
    queryKey: ["affiliate-links-stats"],
    queryFn: async () => {
      // Fetch affiliate links with related data
      const { data: links, error } = await supabase
        .from("royalties_affiliate_links")
        .select(`
          id,
          slug,
          codigo_afiliado,
          link_externo,
          comissao_percentual,
          is_active,
          created_at,
          livro:royalties_livros!livro_id (titulo, valor_capa),
          autor:royalties_autores!autor_id (nome_completo)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch clicks count for each link
      const { data: clicksCounts } = await supabase
        .from("royalties_affiliate_clicks")
        .select("affiliate_link_id");

      // Fetch sales for each link
      const { data: sales } = await supabase
        .from("royalties_affiliate_sales")
        .select("affiliate_link_id, quantidade, valor_venda, valor_comissao");

      // Aggregate stats
      const stats: AffiliateStats[] = links.map((link) => {
        const linkClicks = clicksCounts?.filter(
          (c) => c.affiliate_link_id === link.id
        ) || [];
        const linkSales = sales?.filter(
          (s) => s.affiliate_link_id === link.id
        ) || [];

        return {
          ...link,
          livro: Array.isArray(link.livro) ? link.livro[0] : link.livro,
          autor: Array.isArray(link.autor) ? link.autor[0] : link.autor,
          clicks_count: linkClicks.length,
          sales_count: linkSales.reduce((acc, s) => acc + s.quantidade, 0),
          total_sales_value: linkSales.reduce((acc, s) => acc + Number(s.valor_venda), 0),
          total_commission: linkSales.reduce((acc, s) => acc + Number(s.valor_comissao), 0),
        } as AffiliateStats;
      });

      return stats;
    },
  });

  const filteredLinks = affiliateLinks?.filter(
    (link) =>
      link.livro?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.autor?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.codigo_afiliado.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/livro/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
  };

  const totals = filteredLinks?.reduce(
    (acc, link) => ({
      clicks: acc.clicks + link.clicks_count,
      sales: acc.sales + link.sales_count,
      value: acc.value + link.total_sales_value,
      commission: acc.commission + link.total_commission,
    }),
    { clicks: 0, sales: 0, value: 0, commission: 0 }
  ) || { clicks: 0, sales: 0, value: 0, commission: 0 };

  const conversionRate =
    totals.clicks > 0 ? ((totals.sales / totals.clicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Links de Afiliados</h1>
          <p className="text-muted-foreground">
            Gerencie os links de afiliados e acompanhe as métricas de conversão.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cliques</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.clicks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.sales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Geradas</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totals.commission)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por livro, autor ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Livro</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-center">Cliques</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Valor Vendas</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredLinks?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Nenhum link de afiliado encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLinks?.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">
                      {link.livro?.titulo || "—"}
                    </TableCell>
                    <TableCell>{link.autor?.nome_completo || "—"}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {link.codigo_afiliado}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">{link.clicks_count}</TableCell>
                    <TableCell className="text-center">{link.sales_count}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(link.total_sales_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(link.total_commission)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={link.is_active ? "default" : "secondary"}>
                        {link.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLink(link.slug)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(`/livro/${link.slug}`, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
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
