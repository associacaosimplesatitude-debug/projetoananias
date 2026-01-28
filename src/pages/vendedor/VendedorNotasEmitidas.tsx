import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, MessageCircle, RefreshCw, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface NotaEmitida {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  order_date: string;
  nota_fiscal_numero: string | null;
  nota_fiscal_chave: string | null;
  nota_fiscal_url: string | null;
  status_nfe: string | null;
  nfe_id: number | null;
  valor_total?: number;
  source: 'balcao' | 'shopify';
}

export default function VendedorNotasEmitidas() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const { data: notas, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notas-emitidas-vendedor", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      
      // Buscar de vendas_balcao (PDV/Pagar na Loja)
      const { data: vendasBalcao, error: errorBalcao } = await supabase
        .from("vendas_balcao")
        .select(`
          id, bling_order_id, cliente_nome, cliente_cpf,
          cliente_telefone, valor_total, nota_fiscal_numero,
          nota_fiscal_chave, nota_fiscal_url, nfe_id, status_nfe, created_at
        `)
        .eq("vendedor_id", vendedor.id)
        .not("bling_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (errorBalcao) throw errorBalcao;

      // Buscar de ebd_shopify_pedidos (Pedidos Shopify com NF-e)
      const { data: pedidosShopify, error: errorShopify } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          id, bling_order_id, customer_name, customer_phone,
          valor_total, nota_fiscal_numero, nota_fiscal_chave,
          nota_fiscal_url, nfe_id, status_nfe, created_at
        `)
        .eq("vendedor_id", vendedor.id)
        .not("bling_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (errorShopify) throw errorShopify;

      // Mapear vendas_balcao para formato padrão
      const notasBalcao = vendasBalcao?.map(venda => ({
        id: venda.id,
        order_number: venda.bling_order_id?.toString() || venda.id.slice(0, 8),
        customer_name: venda.cliente_nome || "Cliente",
        customer_phone: venda.cliente_telefone,
        order_date: venda.created_at,
        nota_fiscal_numero: venda.nota_fiscal_numero,
        nota_fiscal_chave: venda.nota_fiscal_chave,
        nota_fiscal_url: venda.nota_fiscal_url,
        status_nfe: venda.status_nfe,
        nfe_id: venda.nfe_id,
        valor_total: venda.valor_total,
        source: 'balcao' as const,
      })) || [];

      // Mapear ebd_shopify_pedidos para formato padrão
      const notasShopify = pedidosShopify?.map(pedido => ({
        id: pedido.id,
        order_number: pedido.bling_order_id?.toString() || pedido.id.slice(0, 8),
        customer_name: pedido.customer_name || "Cliente",
        customer_phone: pedido.customer_phone,
        order_date: pedido.created_at,
        nota_fiscal_numero: pedido.nota_fiscal_numero,
        nota_fiscal_chave: pedido.nota_fiscal_chave,
        nota_fiscal_url: pedido.nota_fiscal_url,
        status_nfe: pedido.status_nfe,
        nfe_id: pedido.nfe_id,
        valor_total: pedido.valor_total || 0,
        source: 'shopify' as const,
      })) || [];

      // Combinar, remover duplicatas (mesmo bling_order_id), ordenar por data
      const allNotas = [...notasBalcao, ...notasShopify];
      const uniqueNotas = allNotas.reduce((acc, nota) => {
        const existing = acc.find(n => n.order_number === nota.order_number);
        if (!existing) {
          acc.push(nota);
        } else if (nota.nota_fiscal_numero && !existing.nota_fiscal_numero) {
          const index = acc.indexOf(existing);
          acc[index] = nota;
        }
        return acc;
      }, [] as typeof allNotas);

      return uniqueNotas.sort((a, b) => 
        new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
    },
    enabled: !!vendedor?.id,
  });

  const formatPhone = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11 || numbers.length === 10) {
      return `55${numbers}`;
    }
    if (numbers.startsWith("55")) {
      return numbers;
    }
    return numbers;
  };

  const handlePrintDanfe = (url: string | null) => {
    if (!url) {
      toast.error("Link do DANFE não disponível");
      return;
    }
    window.open(url, "_blank");
  };

  const handleSendWhatsApp = (nota: NotaEmitida) => {
    const formattedPhone = formatPhone(nota.customer_phone);
    
    if (!formattedPhone) {
      toast.error("Telefone do cliente não disponível");
      return;
    }

    if (!nota.nota_fiscal_url) {
      toast.error("Link do DANFE não disponível");
      return;
    }

    const message = encodeURIComponent(
      `Olá! Segue o link da sua Nota Fiscal:\n${nota.nota_fiscal_url}`
    );
    
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Verificar status das NF-es em processamento no Bling
  const handleCheckNfeStatus = async () => {
    // Incluir notas que têm nfe_id OU order_number (bling_order_id)
    const notasProcessando = notas?.filter(
      n => (n.nfe_id || n.order_number) && ['PROCESSANDO', 'ENVIADA', 'CRIADA'].includes(n.status_nfe || '')
    );

    if (!notasProcessando || notasProcessando.length === 0) {
      toast.info("Nenhuma nota em processamento para verificar");
      refetch();
      return;
    }

    setIsCheckingStatus(true);
    let atualizadas = 0;

    try {
      for (const nota of notasProcessando) {
        // Se tem nfe_id, usar bling-check-nfe-status (fluxo original)
        if (nota.nfe_id) {
          const { data, error } = await supabase.functions.invoke('bling-check-nfe-status', {
            body: { nfe_id: nota.nfe_id, venda_id: nota.id, source: nota.source }
          });

          if (!error && data?.updated) {
            atualizadas++;
          }
        } 
        // Se não tem nfe_id mas tem order_number (bling_order_id), buscar pelo pedido
        else if (nota.order_number) {
          const blingOrderId = parseInt(nota.order_number);
          if (isNaN(blingOrderId)) continue;

          const { data, error } = await supabase.functions.invoke('bling-get-nfe-by-order-id', {
            body: { blingOrderId }
          });

          if (!error && data?.found && data?.linkDanfe) {
            // Atualizar o registro com os dados encontrados
            const updateTable = nota.source === 'shopify' ? 'ebd_shopify_pedidos' : 'vendas_balcao';
            
            const { error: updateError } = await supabase
              .from(updateTable)
              .update({
                nota_fiscal_numero: data.nfeNumero,
                nota_fiscal_url: data.linkDanfe,
                nota_fiscal_chave: data.chave,
                nfe_id: data.nfeId,
                status_nfe: 'AUTORIZADA',
              })
              .eq('id', nota.id);

            if (!updateError) {
              atualizadas++;
            }
          }
        }
      }

      if (atualizadas > 0) {
        toast.success(`${atualizadas} nota(s) atualizada(s)`);
      } else {
        toast.info("Notas ainda em processamento no Bling");
      }
      
      refetch();
    } catch (error: any) {
      console.error("Erro ao verificar status:", error);
      toast.error("Erro ao verificar status das notas");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  if (vendedorLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Notas Emitidas</h1>
        </div>
        
        <Button
          variant="outline"
          onClick={handleCheckNfeStatus}
          disabled={isRefetching || isCheckingStatus}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching || isCheckingStatus ? "animate-spin" : ""}`} />
          {isCheckingStatus ? "Verificando..." : "Atualizar"}
        </Button>
      </div>

      {notas && notas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma nota fiscal emitida encontrada</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF-e</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas?.map((nota) => (
                <TableRow key={nota.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{nota.nota_fiscal_numero || '-'}</span>
                      {nota.nota_fiscal_chave && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={nota.nota_fiscal_chave}>
                          {nota.nota_fiscal_chave.slice(0, 15)}...
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{nota.customer_name || "-"}</TableCell>
                  <TableCell>{formatDate(nota.order_date)}</TableCell>
                  <TableCell>{formatCurrency(nota.valor_total)}</TableCell>
                  <TableCell>
                    {nota.status_nfe === 'AUTORIZADA' ? (
                      <Badge variant="default" className="bg-green-600">
                        Autorizada
                      </Badge>
                    ) : nota.status_nfe === 'REJEITADA' ? (
                      <Badge variant="destructive">
                        Rejeitada
                      </Badge>
                    ) : nota.status_nfe === 'PROCESSANDO' || nota.status_nfe === 'ENVIADA' || nota.status_nfe === 'CRIADA' ? (
                      <Badge variant="secondary">
                        Processando
                      </Badge>
                    ) : nota.nota_fiscal_chave ? (
                      <Badge variant="default" className="bg-green-600">
                        Autorizada
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Processando
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintDanfe(nota.nota_fiscal_url)}
                        disabled={!nota.nota_fiscal_url}
                        title="Imprimir DANFE"
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        DANFE
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendWhatsApp(nota)}
                        disabled={!nota.nota_fiscal_url || !nota.customer_phone}
                        title="Enviar via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        WhatsApp
                      </Button>
                      {nota.nota_fiscal_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(nota.nota_fiscal_url!, "_blank")}
                          title="Abrir link externo"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
