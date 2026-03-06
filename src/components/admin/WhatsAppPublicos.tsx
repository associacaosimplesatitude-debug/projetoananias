import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Users, Calendar, Phone, Mail, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contato {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  valor_total: number;
  data_pedido: string;
  order_number: string;
  vendedor_id: string | null;
  produtos: string;
  tem_desconto: boolean;
  percentual_desconto: number | null;
}

interface PublicoMes {
  mes: string;
  total_contatos: number;
  com_desconto: number;
  sem_desconto: number;
  contatos: Contato[];
}

export default function WhatsAppPublicos() {
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const { data: publicos, isLoading } = useQuery({
    queryKey: ["publicos-revistas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_publicos_revistas_por_mes");
      if (error) throw error;
      return (data as unknown as PublicoMes[]) || [];
    },
  });

  const toggleMonth = (mes: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mes)) next.delete(mes);
      else next.add(mes);
      return next;
    });
  };

  const formatMes = (mesStr: string) => {
    const d = new Date(mesStr);
    return format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Públicos de Compradores de Revistas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Públicos de Compradores de Revistas
        </CardTitle>
        <CardDescription>
          Contatos únicos agrupados por mês de compra. Novos compradores entram automaticamente no mês atual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!publicos || publicos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum público encontrado.</p>
        ) : (
          publicos.map((pub) => {
            const isOpen = openMonths.has(pub.mes);
            return (
              <Collapsible key={pub.mes} open={isOpen} onOpenChange={() => toggleMonth(pub.mes)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatMes(pub.mes)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant="secondary" className="text-sm">
                      {pub.total_contatos} contato{pub.total_contatos !== 1 ? "s" : ""}
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {pub.com_desconto} com desconto
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {pub.sem_desconto} sem desconto
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Desconto</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="max-w-[200px]">Produtos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pub.contatos.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{c.customer_name || "-"}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-xs">
                                <Mail className="h-3 w-3" />
                                {c.customer_email || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" />
                                {c.customer_phone || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {c.tem_desconto && c.percentual_desconto ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                  {c.percentual_desconto}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{c.order_number || "-"}</TableCell>
                            <TableCell className="text-xs font-medium">
                              {c.valor_total ? formatCurrency(c.valor_total) : "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {c.data_pedido ? format(new Date(c.data_pedido), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] text-xs truncate" title={c.produtos}>
                              {c.produtos || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
