import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, Clock, AlertTriangle, Calendar, ExternalLink,
  Wallet, FileText, Download, User, Search, Loader2, RefreshCw
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface ComissaoItem {
  id: string;
  vendedor_id: string | null;
  vendedor_nome: string;
  vendedor_foto?: string | null;
  cliente_id: string;
  cliente_nome: string;
  tipo: 'online' | 'faturado';
  numero_parcela: number;
  total_parcelas: number;
  data_vencimento: string;
  data_liberacao: string | null;
  valor: number;
  valor_comissao: number;
  comissao_status: string;
  metodo_pagamento: string | null;
  bling_order_number: string | null;
  link_danfe: string | null;
  bling_order_id: number | null;
  canSearchBlingOrder?: boolean;
  shopify_order_number?: string | null;
  customer_email?: string | null;
  order_value?: number | null;
  order_date?: string | null;
  shopify_pedido_id?: string | null;
  isFetchingNfe?: boolean;
}

interface BuscarNfeParams {
  parcelaId: string;
  blingOrderId?: number | null;
  shopifyOrderNumber?: string | null;
  customerEmail?: string | null;
  orderValue?: number | null;
  orderDate?: string | null;
  shopifyPedidoId?: string | null;
}

interface VendedorAgrupado {
  vendedor_id: string | null;
  vendedor_nome: string;
  vendedor_foto: string | null;
  total_comissao: number;
  quantidade: number;
  comissoes: ComissaoItem[];
}

interface ComissaoAgrupadaVendedorProps {
  comissoes: ComissaoItem[];
  onMarcarPaga: (id: string) => void;
  onBuscarNfe?: (params: BuscarNfeParams) => void;
  onRefazerNfe?: (params: BuscarNfeParams) => void;
  onGerarPagamentoVendedor?: (vendedorId: string, comissoes: ComissaoItem[]) => void;
  isUpdating?: boolean;
}

export function ComissaoAgrupadaVendedor({ 
  comissoes, 
  onMarcarPaga, 
  onBuscarNfe,
  onRefazerNfe,
  onGerarPagamentoVendedor,
  isUpdating 
}: ComissaoAgrupadaVendedorProps) {
  const [expandedVendedores, setExpandedVendedores] = useState<string[]>([]);

  // Agrupar por vendedor
  const vendedoresAgrupados: VendedorAgrupado[] = Object.values(
    comissoes.reduce((acc, c) => {
      const key = c.vendedor_id || c.vendedor_nome;
      if (!acc[key]) {
        acc[key] = {
          vendedor_id: c.vendedor_id,
          vendedor_nome: c.vendedor_nome,
          vendedor_foto: c.vendedor_foto || null,
          total_comissao: 0,
          quantidade: 0,
          comissoes: []
        };
      }
      acc[key].total_comissao += c.valor_comissao;
      acc[key].quantidade++;
      acc[key].comissoes.push(c);
      return acc;
    }, {} as Record<string, VendedorAgrupado>)
  ).sort((a, b) => b.total_comissao - a.total_comissao);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paga":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paga
          </Badge>
        );
      case "liberada":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <Wallet className="h-3 w-3 mr-1" />
            Liberada
          </Badge>
        );
      case "agendada":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Calendar className="h-3 w-3 mr-1" />
            Agendada
          </Badge>
        );
      case "atrasada":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Atrasada
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === "online") {
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Online</Badge>;
    }
    return <Badge variant="outline">Faturado</Badge>;
  };

  if (vendedoresAgrupados.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Nenhuma comissão encontrada para os filtros selecionados.
      </p>
    );
  }

  return (
    <Accordion 
      type="multiple" 
      value={expandedVendedores}
      onValueChange={setExpandedVendedores}
      className="space-y-2"
    >
      {vendedoresAgrupados.map((vendedor) => (
        <AccordionItem 
          key={vendedor.vendedor_id || vendedor.vendedor_nome}
          value={vendedor.vendedor_id || vendedor.vendedor_nome}
          className="border rounded-lg px-4 bg-card"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={vendedor.vendedor_foto || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(vendedor.vendedor_nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-medium">{vendedor.vendedor_nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {vendedor.quantidade} {vendedor.quantidade === 1 ? 'item' : 'itens'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold text-purple-600">
                  R$ {vendedor.total_comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2 pb-4">
              {/* Botão de ação por vendedor */}
              {onGerarPagamentoVendedor && vendedor.vendedor_id && (
                <div className="flex justify-end gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onGerarPagamentoVendedor(vendedor.vendedor_id!, vendedor.comissoes)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar pagamento
                  </Button>
                </div>
              )}

              {/* Tabela de comissões do vendedor */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Vendedor
                        </div>
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Liberação</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedor.comissoes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={item.vendedor_foto || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(item.vendedor_nome)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{item.vendedor_nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{item.cliente_nome}</TableCell>
                        <TableCell>{getTipoBadge(item.tipo)}</TableCell>
                        <TableCell>{item.numero_parcela}/{item.total_parcelas}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.data_liberacao 
                            ? format(parseISO(item.data_liberacao), "dd/MM/yyyy")
                            : <span className="text-muted-foreground">-</span>
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold text-purple-600">
                          R$ {item.valor_comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.comissao_status)}</TableCell>
                        <TableCell>
                          {item.link_danfe ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{item.bling_order_number || 'DANFE'}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                                onClick={() => window.open(item.link_danfe!, "_blank")}
                                title="Ver DANFE"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              {/* Botão Refazer NF */}
                              {onRefazerNfe && (item.bling_order_id || item.canSearchBlingOrder) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-orange-500 hover:text-orange-700"
                                  onClick={() => onRefazerNfe({
                                    parcelaId: item.id,
                                    blingOrderId: item.bling_order_id,
                                    shopifyOrderNumber: item.shopify_order_number,
                                    customerEmail: item.customer_email,
                                    orderValue: item.order_value,
                                    orderDate: item.order_date,
                                    shopifyPedidoId: item.shopify_pedido_id
                                  })}
                                  disabled={item.isFetchingNfe}
                                  title="Refazer busca de NF"
                                >
                                  {item.isFetchingNfe ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (item.bling_order_id || item.canSearchBlingOrder) && onBuscarNfe ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                const debugFields = {
                                  id: item.id,
                                  pedido_id: (item as any).pedido_id,
                                  numero_pedido: (item as any).numero_pedido,
                                  bling_order_id: item.bling_order_id,
                                  bling_pedido_id: (item as any).bling_pedido_id,
                                  id_pedido_venda_bling: (item as any).id_pedido_venda_bling,
                                  sale_id: (item as any).sale_id,
                                };
                                const payload = {
                                  parcelaId: item.id,
                                  blingOrderId: item.bling_order_id,
                                  shopifyOrderNumber: item.shopify_order_number,
                                  customerEmail: item.customer_email,
                                  orderValue: item.order_value,
                                  orderDate: item.order_date,
                                  shopifyPedidoId: item.shopify_pedido_id,
                                };

                                console.groupCollapsed('[NF] Clique lupa (agrupado) - item/payload');
                                console.log('item fields:', debugFields);
                                console.log('payload onBuscarNfe:', payload);
                                console.groupEnd();

                                onBuscarNfe(payload);
                              }}
                              disabled={item.isFetchingNfe}
                              title="Buscar NF no Bling"
                            >
                              {item.isFetchingNfe ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Search className="h-3 w-3 mr-1" />
                                  NF
                                </>
                              )}
                            </Button>
                          ) : item.tipo === 'online' ? (
                            <span className="text-xs text-muted-foreground">Aguardando</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.comissao_status === "liberada" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMarcarPaga(item.id)}
                              disabled={isUpdating}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
