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
  status_pagamento: string;
  status_nfe: string | null;
  nfe_id: number | null;
  cliente_telefone?: string | null;
}

export default function VendedorNotasEmitidas() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  const { data: notas, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notas-emitidas", vendedor?.id],
    queryFn: async () => {
      // Buscar pedidos com NF-e emitida ou em processamento
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          order_date,
          nota_fiscal_numero,
          nota_fiscal_chave,
          nota_fiscal_url,
          status_pagamento,
          status_nfe,
          nfe_id,
          cliente_id
        `)
        .or("nota_fiscal_numero.not.is.null,status_nfe.not.is.null")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Buscar telefones dos clientes para casos onde customer_phone não está preenchido
      const clienteIds = data
        ?.map(p => p.cliente_id)
        .filter(Boolean) as string[];

      let clientesTelefones: Record<string, string> = {};
      
      if (clienteIds.length > 0) {
        const { data: clientes } = await supabase
          .from("ebd_clientes")
          .select("id, telefone")
          .in("id", clienteIds);
        
        if (clientes) {
          clientesTelefones = clientes.reduce((acc, c) => {
            if (c.telefone) acc[c.id] = c.telefone;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return data?.map(pedido => ({
        ...pedido,
        cliente_telefone: pedido.cliente_id ? clientesTelefones[pedido.cliente_id] : null
      })) as NotaEmitida[];
    },
    enabled: !vendedorLoading,
  });

  const formatPhone = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    // Remove caracteres não numéricos
    const numbers = phone.replace(/\D/g, "");
    // Adiciona 55 se não começar com ele
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
    const phone = nota.customer_phone || nota.cliente_telefone;
    const formattedPhone = formatPhone(phone);
    
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Notas Emitidas</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
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
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>NF-e</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas?.map((nota) => (
                <TableRow key={nota.id}>
                  <TableCell className="font-medium">
                    #{nota.order_number}
                  </TableCell>
                  <TableCell>{nota.customer_name || "-"}</TableCell>
                  <TableCell>{formatDate(nota.order_date)}</TableCell>
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
                        disabled={!nota.nota_fiscal_url || (!nota.customer_phone && !nota.cliente_telefone)}
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
