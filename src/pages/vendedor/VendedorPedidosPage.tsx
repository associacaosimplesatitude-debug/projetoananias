import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VendedorPedidosTab } from "@/components/vendedor/VendedorPedidosTab";
import { useVendedor } from "@/hooks/useVendedor";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, Clock, ExternalLink, Loader2, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PropostaItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
}

interface PropostaCliente {
  id: string;
  nome_igreja: string;
  cnpj: string;
  email_superintendente: string | null;
  telefone: string | null;
  nome_responsavel: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  pode_faturar: boolean;
  desconto_faturamento?: number | null;
}

interface Proposta {
  id: string;
  token: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_endereco: Record<string, string> | null;
  itens: PropostaItem[];
  valor_total: number;
  valor_produtos: number;
  valor_frete: number | null;
  desconto_percentual: number | null;
  metodo_frete: string | null;
  pode_faturar: boolean | null;
  prazo_faturamento_selecionado: string | null;
  vendedor_nome: string | null;
  status: string;
  created_at: string;
  confirmado_em: string | null;
  cliente?: PropostaCliente | null;
}

export default function VendedorPedidosPage() {
  const { vendedor, isLoading } = useVendedor();
  const [processingPropostaId, setProcessingPropostaId] = useState<string | null>(null);

  const { data: propostas, isLoading: isLoadingPropostas, refetch } = useQuery({
    queryKey: ["vendedor-propostas", vendedor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select(`
          *,
          cliente:ebd_clientes(
            id,
            nome_igreja,
            cnpj,
            email_superintendente,
            telefone,
            nome_responsavel,
            endereco_cep,
            endereco_rua,
            endereco_numero,
            endereco_bairro,
            endereco_cidade,
            endereco_estado,
            pode_faturar,
            desconto_faturamento
          )
        `)
        .eq("vendedor_id", vendedor!.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as Proposta[];
    },
    enabled: !!vendedor?.id,
  });

  const copyLink = async (token: string) => {
    // Usar domínio de produção para o link da proposta
    const link = `https://gestaoebd.com.br/proposta/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleGeneratePaymentLink = async (proposta: Proposta) => {
    // Check if this is a B2B proposal with faturamento
    if (proposta.pode_faturar && proposta.prazo_faturamento_selecionado) {
      // Direct B2B faturamento - no popup needed
      await processFaturamento(proposta);
      return;
    }

    // Standard payment flow - create Draft Order directly
    await processPaymentLink(proposta);
  };

  const processFaturamento = async (proposta: Proposta) => {
    setProcessingPropostaId(proposta.id);

    try {
      const cliente = proposta.cliente || {
        id: proposta.cliente_id || '',
        nome_igreja: proposta.cliente_nome,
        cnpj: proposta.cliente_cnpj || '',
        email_superintendente: null,
        telefone: null,
        nome_responsavel: proposta.cliente_nome,
        endereco_cep: proposta.cliente_endereco?.cep || null,
        endereco_rua: proposta.cliente_endereco?.rua || null,
        endereco_numero: proposta.cliente_endereco?.numero || null,
        endereco_bairro: proposta.cliente_endereco?.bairro || null,
        endereco_cidade: proposta.cliente_endereco?.cidade || null,
        endereco_estado: proposta.cliente_endereco?.estado || null,
        pode_faturar: true,
      };

      // Use saved values from accepted proposal
      const prazo = proposta.prazo_faturamento_selecionado || '30';
      const desconto = proposta.desconto_percentual || 0;
      const valorFrete = proposta.valor_frete || 0;
      const metodoFrete = proposta.metodo_frete || 'COMBINAR';

      const { data, error } = await supabase.functions.invoke('ebd-shopify-order-create', {
        body: {
          cliente,
          vendedor_id: vendedor?.id,
          vendedor_nome: proposta.vendedor_nome || vendedor?.nome,
          items: proposta.itens,
          forma_pagamento: 'FATURAMENTO',
          faturamento_prazo: prazo,
          desconto_percentual: desconto.toString(),
          valor_frete: valorFrete.toString(),
          metodo_frete: metodoFrete,
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update proposta status to FATURADO
      await supabase
        .from("vendedor_propostas")
        .update({ status: "FATURADO" })
        .eq("id", proposta.id);

      if (data?.isFaturamento && data?.blingOrderId) {
        const blingIdentifier = data.blingOrderNumber || data.blingOrderId;
        toast.success(`Pedido enviado para faturamento no Bling!`, {
          description: `Prazo: ${prazo} dias • Pedido Bling: ${blingIdentifier}`,
          duration: 5000,
        });
        refetch();
      } else {
        throw new Error("Resposta inesperada do servidor");
      }
    } catch (error: unknown) {
      console.error("Erro ao faturar pedido:", error);
      toast.error("Erro ao faturar pedido", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setProcessingPropostaId(null);
    }
  };

  const processPaymentLink = async (proposta: Proposta) => {
    setProcessingPropostaId(proposta.id);

    try {
      // Build cliente object from proposta
      const cliente = proposta.cliente || {
        id: proposta.cliente_id || '',
        nome_igreja: proposta.cliente_nome,
        cnpj: proposta.cliente_cnpj || '',
        email_superintendente: null,
        telefone: null,
        nome_responsavel: proposta.cliente_nome,
        endereco_cep: proposta.cliente_endereco?.cep || null,
        endereco_rua: proposta.cliente_endereco?.rua || null,
        endereco_numero: proposta.cliente_endereco?.numero || null,
        endereco_bairro: proposta.cliente_endereco?.bairro || null,
        endereco_cidade: proposta.cliente_endereco?.cidade || null,
        endereco_estado: proposta.cliente_endereco?.estado || null,
        pode_faturar: false,
      };

      // Use all saved values from the accepted proposal
      const { data, error } = await supabase.functions.invoke('ebd-shopify-order-create', {
        body: {
          cliente,
          vendedor_id: vendedor?.id,
          vendedor_nome: proposta.vendedor_nome || vendedor?.nome,
          items: proposta.itens,
          valor_frete: (proposta.valor_frete || 0).toString(),
          metodo_frete: proposta.metodo_frete || 'COMBINAR',
          desconto_percentual: (proposta.desconto_percentual || 0).toString(),
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update proposta status to AGUARDANDO_PAGAMENTO
      await supabase
        .from("vendedor_propostas")
        .update({ status: "AGUARDANDO_PAGAMENTO" })
        .eq("id", proposta.id);

      if (data?.invoiceUrl) {
        toast.success("Link de pagamento gerado com sucesso!");
        window.open(data.invoiceUrl, '_blank');
        refetch();
      } else {
        throw new Error("Resposta inesperada do servidor");
      }
    } catch (error: unknown) {
      console.error("Erro ao gerar link de pagamento:", error);
      toast.error("Erro ao gerar link de pagamento", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setProcessingPropostaId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROPOSTA_PENDENTE":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "PROPOSTA_ACEITA":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Aceita</Badge>;
      case "AGUARDANDO_PAGAMENTO":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><CreditCard className="w-3 h-3 mr-1" /> Aguardando Pagamento</Badge>;
      case "FATURADO":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><FileText className="w-3 h-3 mr-1" /> Faturado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const propostasPendentes = propostas?.filter(p => p.status === "PROPOSTA_PENDENTE") || [];
  const propostasAceitas = propostas?.filter(p => p.status === "PROPOSTA_ACEITA") || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pedidos e Propostas</h2>
        <p className="text-muted-foreground">Acompanhe pedidos e propostas digitais</p>
      </div>

      <Tabs defaultValue="propostas">
        <TabsList>
          <TabsTrigger value="propostas" className="flex items-center gap-2">
            Propostas Digitais
            {(propostasPendentes.length + propostasAceitas.length) > 0 && (
              <Badge variant="secondary" className="ml-1">{propostasPendentes.length + propostasAceitas.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos Confirmados</TabsTrigger>
        </TabsList>

        <TabsContent value="propostas" className="space-y-4 mt-4">
          {isLoadingPropostas ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : propostas?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma proposta gerada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {propostas?.map((proposta) => (
                <Card key={proposta.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{proposta.cliente_nome}</span>
                          {getStatusBadge(proposta.status)}
                          {proposta.pode_faturar && (
                            <Badge variant="outline" className="text-xs">
                              B2B {proposta.prazo_faturamento_selecionado && `• ${proposta.prazo_faturamento_selecionado} dias`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          R$ {proposta.valor_total.toFixed(2)} • Criada em {format(new Date(proposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                        {proposta.confirmado_em && (
                          <p className="text-xs text-green-600">
                            Confirmada em {format(new Date(proposta.confirmado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {proposta.status === "PROPOSTA_ACEITA" && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleGeneratePaymentLink(proposta)}
                            disabled={processingPropostaId === proposta.id}
                          >
                            {processingPropostaId === proposta.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : proposta.pode_faturar && proposta.prazo_faturamento_selecionado ? (
                              <FileText className="h-4 w-4 mr-1" />
                            ) : (
                              <CreditCard className="h-4 w-4 mr-1" />
                            )}
                            {proposta.pode_faturar && proposta.prazo_faturamento_selecionado ? "Faturar Pedido" : "Gerar Link Pagamento"}
                          </Button>
                        )}
                        {(proposta.status === "PROPOSTA_PENDENTE" || proposta.status === "PROPOSTA_ACEITA") && (
                          <Button variant="outline" size="sm" onClick={() => copyLink(proposta.token)}>
                            <Copy className="h-4 w-4 mr-1" /> Copiar Link
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/proposta/${proposta.token}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4">
          <VendedorPedidosTab vendedorId={vendedor?.id || ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
