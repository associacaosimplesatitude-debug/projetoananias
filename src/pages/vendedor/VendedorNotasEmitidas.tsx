import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, MessageCircle, RefreshCw, FileText, ExternalLink, Download, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}

export default function VendedorNotasEmitidas() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const [isImporting, setIsImporting] = useState(false);

  const { data: notas, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notas-emitidas-balcao", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      
      // Buscar de vendas_balcao - vendas feitas no PDV/balcão
      const { data, error } = await supabase
        .from("vendas_balcao")
        .select(`
          id,
          bling_order_id,
          cliente_nome,
          cliente_cpf,
          cliente_telefone,
          valor_total,
          nota_fiscal_numero,
          nota_fiscal_chave,
          nota_fiscal_url,
          nfe_id,
          status_nfe,
          created_at
        `)
        .eq("vendedor_id", vendedor.id)
        .not("nota_fiscal_numero", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return data?.map(venda => ({
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
      })) as NotaEmitida[];
    },
    enabled: !!vendedor?.id,
  });

  const handleImportNfes = async (periodo: string) => {
    setIsImporting(true);
    
    try {
      let dataInicial: string;
      let dataFinal: string;
      const today = new Date();
      
      switch (periodo) {
        case "hoje":
          dataInicial = format(today, "yyyy-MM-dd");
          dataFinal = format(today, "yyyy-MM-dd");
          break;
        case "semana":
          dataInicial = format(subDays(today, 7), "yyyy-MM-dd");
          dataFinal = format(today, "yyyy-MM-dd");
          break;
        case "mes":
          dataInicial = format(subDays(today, 30), "yyyy-MM-dd");
          dataFinal = format(today, "yyyy-MM-dd");
          break;
        default:
          dataInicial = format(today, "yyyy-MM-dd");
          dataFinal = format(today, "yyyy-MM-dd");
      }

      const response = await supabase.functions.invoke("bling-import-nfe-penha", {
        body: { dataInicial, dataFinal },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      
      if (result.success) {
        toast.success(result.message || `${result.imported} notas importadas`);
        refetch();
      } else {
        toast.error(result.error || "Erro ao importar NF-es");
      }
    } catch (error: any) {
      console.error("Erro importando NF-es:", error);
      toast.error(error.message || "Erro ao importar NF-es do Bling");
    } finally {
      setIsImporting(false);
    }
  };

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
        
        <div className="flex items-center gap-2">
          <Select onValueChange={handleImportNfes} disabled={isImporting}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={
                isImporting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Importar do Bling
                  </span>
                )
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Últimos 7 dias</SelectItem>
              <SelectItem value="mes">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {notas && notas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-4">Nenhuma nota fiscal emitida encontrada</p>
          <p className="text-sm">Clique em "Importar do Bling" para buscar as NF-es</p>
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
