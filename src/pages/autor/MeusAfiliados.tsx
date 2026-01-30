import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Link2,
  MousePointer,
  ShoppingCart,
  TrendingUp,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface MyAffiliateLink {
  id: string;
  slug: string;
  codigo_afiliado: string;
  comissao_percentual: number;
  is_active: boolean;
  livro: { titulo: string; valor_capa: number; capa_url: string | null };
  clicks_count: number;
  sales_count: number;
  total_commission: number;
}

export default function MeusAfiliados() {
  const { autorId } = useRoyaltiesAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: myLinks, isLoading } = useQuery({
    queryKey: ["my-affiliate-links", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      // Fetch author's affiliate links
      const { data: links, error } = await supabase
        .from("royalties_affiliate_links")
        .select(`
          id,
          slug,
          codigo_afiliado,
          comissao_percentual,
          is_active,
          livro:royalties_livros!livro_id (titulo, valor_capa, capa_url)
        `)
        .eq("autor_id", autorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch clicks for these links
      const linkIds = links.map((l) => l.id);
      const { data: clicks } = await supabase
        .from("royalties_affiliate_clicks")
        .select("affiliate_link_id")
        .in("affiliate_link_id", linkIds);

      // Fetch sales for these links
      const { data: sales } = await supabase
        .from("royalties_affiliate_sales")
        .select("affiliate_link_id, quantidade, valor_comissao")
        .in("affiliate_link_id", linkIds);

      // Aggregate stats
      const result: MyAffiliateLink[] = links.map((link) => ({
        ...link,
        livro: Array.isArray(link.livro) ? link.livro[0] : link.livro,
        clicks_count: clicks?.filter((c) => c.affiliate_link_id === link.id).length || 0,
        sales_count:
          sales
            ?.filter((s) => s.affiliate_link_id === link.id)
            .reduce((acc, s) => acc + s.quantidade, 0) || 0,
        total_commission:
          sales
            ?.filter((s) => s.affiliate_link_id === link.id)
            .reduce((acc, s) => acc + Number(s.valor_comissao), 0) || 0,
      }));

      return result;
    },
    enabled: !!autorId,
  });

  const copyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/livro/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totals = myLinks?.reduce(
    (acc, link) => ({
      clicks: acc.clicks + link.clicks_count,
      sales: acc.sales + link.sales_count,
      commission: acc.commission + link.total_commission,
    }),
    { clicks: 0, sales: 0, commission: 0 }
  ) || { clicks: 0, sales: 0, commission: 0 };

  const conversionRate =
    totals.clicks > 0 ? ((totals.sales / totals.clicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meus Links de Afiliado</h1>
        <p className="text-muted-foreground">
          Compartilhe seus links e ganhe 30% de comissão sobre cada venda!
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Links Ativos</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myLinks?.filter((l) => l.is_active).length || 0}
            </div>
          </CardContent>
        </Card>

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
            <CardTitle className="text-sm font-medium">Vendas Geradas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.sales}</div>
            <p className="text-xs text-muted-foreground">Conversão: {conversionRate}%</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Comissões Ganhas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totals.commission)}
            </div>
            <p className="text-xs text-green-600">30% sobre cada venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Links List */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Links</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : myLinks?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Você ainda não possui links de afiliado.
            </div>
          ) : (
            <div className="space-y-4">
              {myLinks?.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg"
                >
                  {/* Book Cover */}
                  <div className="flex-shrink-0">
                    {link.livro?.capa_url ? (
                      <img
                        src={link.livro.capa_url}
                        alt={link.livro.titulo}
                        className="w-20 h-28 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-28 bg-muted rounded flex items-center justify-center">
                        <Link2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{link.livro?.titulo || "—"}</h3>
                        <Badge
                          variant={link.is_active ? "default" : "secondary"}
                          className="mt-1"
                        >
                          {link.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Comissão</p>
                        <p className="font-bold text-green-600">
                          {link.comissao_percentual}%
                        </p>
                      </div>
                    </div>

                    {/* Link URL */}
                    <div className="flex items-center gap-2 bg-muted p-2 rounded">
                      <code className="flex-1 text-sm truncate">
                        {window.location.origin}/livro/{link.slug}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(link.slug, link.id)}
                      >
                        {copiedId === link.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/livro/${link.slug}`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cliques: </span>
                        <span className="font-medium">{link.clicks_count}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vendas: </span>
                        <span className="font-medium">{link.sales_count}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Comissão: </span>
                        <span className="font-medium text-green-600">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(link.total_commission)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
