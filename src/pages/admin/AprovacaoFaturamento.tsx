import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, Loader2, Search, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

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

interface Vendedor {
  id: string;
  nome: string;
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
  vendedor_id: string | null;
  status: string;
  created_at: string;
  confirmado_em: string | null;
  cliente?: PropostaCliente | null;
  vendedor?: Vendedor | null;
}

export default function AprovacaoFaturamento() {
  const queryClient = useQueryClient();
  const [processingPropostaId, setProcessingPropostaId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<Proposta | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: propostas, isLoading, refetch } = useQuery({
    queryKey: ["propostas-aguardando-aprovacao"],
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
          ),
          vendedor:vendedores(id, nome)
        `)
        .eq("status", "AGUARDANDO_APROVACAO_FINANCEIRA")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as Proposta[];
    },
  });

  const handleAprovar = async (proposta: Proposta) => {
    setProcessingPropostaId(proposta.id);

    try {
      const clienteProposta = proposta.cliente || {
        id: proposta.cliente_id || "",
        nome_igreja: proposta.cliente_nome,
        cnpj: proposta.cliente_cnpj || "",
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

      const prazo = proposta.prazo_faturamento_selecionado || "30";
      const descontoPercentual = proposta.desconto_percentual || 0;
      const valorFrete = proposta.valor_frete || 0;
      const metodoFrete = proposta.metodo_frete || "COMBINAR";

      const itensBling = proposta.itens.map((item) => {
        const precoOriginal = Number(item.price);
        const precoComDesconto = descontoPercentual > 0
          ? Math.round((precoOriginal * (1 - descontoPercentual / 100)) * 100) / 100
          : precoOriginal;

        return {
          codigo: undefined,
          descricao: item.title,
          unidade: "UN",
          quantidade: item.quantity,
          valor: precoComDesconto,
          preco_cheio: precoOriginal,
        };
      });

      const valorProdutosSemDesconto = proposta.itens.reduce(
        (sum, i) => sum + Number(i.price) * i.quantity,
        0
      );
      const valorProdutos = descontoPercentual > 0
        ? Math.round((valorProdutosSemDesconto * (1 - descontoPercentual / 100)) * 100) / 100
        : Math.round(valorProdutosSemDesconto * 100) / 100;
      const valorTotal = Math.round((valorProdutos + valorFrete) * 100) / 100;

      const clienteBling = {
        nome: clienteProposta.nome_responsavel || clienteProposta.nome_igreja,
        sobrenome: null,
        cpf_cnpj: clienteProposta.cnpj,
        email: clienteProposta.email_superintendente,
        telefone: clienteProposta.telefone,
      };

      const enderecoEntrega = clienteProposta.endereco_rua
        ? {
            rua: clienteProposta.endereco_rua,
            numero: clienteProposta.endereco_numero || "S/N",
            complemento: "",
            bairro: clienteProposta.endereco_bairro || "",
            cep: clienteProposta.endereco_cep || "",
            cidade: clienteProposta.endereco_cidade || "",
            estado: clienteProposta.endereco_estado || "",
          }
        : null;

      // Primeiro atualiza o status para APROVADA_FATURAMENTO
      await supabase
        .from("vendedor_propostas")
        .update({ status: "APROVADA_FATURAMENTO" })
        .eq("id", proposta.id);

      // Depois envia para o Bling
      const { data, error } = await supabase.functions.invoke("bling-create-order", {
        body: {
          cliente: clienteBling,
          endereco_entrega: enderecoEntrega,
          itens: itensBling,
          pedido_id: proposta.id,
          valor_frete: valorFrete,
          metodo_frete: metodoFrete,
          forma_pagamento: "FATURAMENTO",
          faturamento_prazo: prazo,
          valor_produtos: valorProdutos,
          valor_total: valorTotal,
          vendedor_nome: proposta.vendedor_nome || proposta.vendedor?.nome,
          desconto_percentual: descontoPercentual,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Atualiza para FATURADO após sucesso no Bling
      await supabase
        .from("vendedor_propostas")
        .update({ status: "FATURADO" })
        .eq("id", proposta.id);

      if (data?.success && (data?.bling_order_id || data?.bling_order_number)) {
        const blingIdentifier = data.bling_order_number || data.bling_order_id;
        
        // Calcular valor para meta (valor produtos - sem frete)
        const valorParaMeta = valorProdutos;
        
        // Criar registro em ebd_shopify_pedidos para contabilizar na meta do vendedor
        const itensResumo = proposta.itens.map(i => `${i.quantity}x ${i.title}`).join(", ");
        
        const { error: insertError } = await supabase
          .from("ebd_shopify_pedidos")
          .insert({
            shopify_order_id: data.bling_order_id || Math.floor(Math.random() * 1000000000),
            order_number: `BLING-${blingIdentifier}`,
            vendedor_id: proposta.vendedor_id,
            cliente_id: proposta.cliente_id,
            valor_total: valorTotal,
            valor_frete: valorFrete,
            valor_para_meta: valorParaMeta,
            status_pagamento: "Faturado",
            customer_email: proposta.cliente?.email_superintendente || null,
            customer_name: proposta.cliente_nome,
            order_date: new Date().toISOString(),
          });
        
        if (insertError) {
          console.error("Erro ao inserir pedido para meta:", insertError);
        }
        
        toast.success("Pedido aprovado e enviado para faturamento!", {
          description: `Prazo: ${prazo} dias • Pedido Bling: ${blingIdentifier}`,
          duration: 5000,
        });
        // Invalidate queries to update vendedor panel
        queryClient.invalidateQueries({ queryKey: ["vendedor-propostas-faturadas"] });
        queryClient.invalidateQueries({ queryKey: ["vendedor-propostas"] });
        queryClient.invalidateQueries({ queryKey: ["vendedor-vendas-mes"] });
        queryClient.invalidateQueries({ queryKey: ["ebd-shopify-orders"] });
        refetch();
      } else {
        throw new Error("Resposta inesperada do servidor");
      }
    } catch (error: unknown) {
      console.error("Erro ao aprovar e faturar pedido:", error);
      toast.error("Erro ao aprovar pedido", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
      // Reverter status em caso de erro
      await supabase
        .from("vendedor_propostas")
        .update({ status: "AGUARDANDO_APROVACAO_FINANCEIRA" })
        .eq("id", proposta.id);
    } finally {
      setProcessingPropostaId(null);
    }
  };

  const handleReprovar = async () => {
    if (!selectedProposta) return;
    
    setProcessingPropostaId(selectedProposta.id);

    try {
      const { error } = await supabase
        .from("vendedor_propostas")
        .update({ 
          status: "REPROVADA_FINANCEIRO"
        })
        .eq("id", selectedProposta.id);

      if (error) throw error;

      toast.success("Proposta reprovada");
      setRejectDialogOpen(false);
      setSelectedProposta(null);
      setRejectReason("");
      refetch();
    } catch (error: unknown) {
      console.error("Erro ao reprovar proposta:", error);
      toast.error("Erro ao reprovar proposta", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setProcessingPropostaId(null);
    }
  };

  const openRejectDialog = (proposta: Proposta) => {
    setSelectedProposta(proposta);
    setRejectDialogOpen(true);
  };

  const filteredPropostas = propostas?.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.cliente_nome.toLowerCase().includes(term) ||
      p.vendedor?.nome?.toLowerCase().includes(term) ||
      p.vendedor_nome?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">Aprovação de Faturamento</h2>
        <p className="text-muted-foreground">Aprovar ou reprovar pedidos B2B para faturamento</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="h-9 px-3">
          {filteredPropostas?.length || 0} pendentes
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : filteredPropostas?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">Nenhuma proposta aguardando aprovação</p>
            <p className="text-muted-foreground">Todas as propostas B2B foram processadas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPropostas?.map((proposta) => (
            <Card key={proposta.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg">{proposta.cliente_nome}</span>
                      <Badge variant="outline" className="border-orange-500 text-orange-600">
                        <Clock className="w-3 h-3 mr-1" /> Aguardando Aprovação
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        B2B • {proposta.prazo_faturamento_selecionado || "30"} dias
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Valor Total:</span>
                        <p className="font-medium">R$ {proposta.valor_total.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Desconto:</span>
                        <p className="font-medium">{proposta.desconto_percentual || 0}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Frete:</span>
                        <p className="font-medium">R$ {(proposta.valor_frete || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vendedor:</span>
                        <p className="font-medium">{proposta.vendedor?.nome || proposta.vendedor_nome || "N/A"}</p>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Criada em {format(new Date(proposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {proposta.confirmado_em && (
                        <> • Aceita em {format(new Date(proposta.confirmado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
                      )}
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Itens: </span>
                      {proposta.itens.map((item, idx) => (
                        <span key={idx}>
                          {item.quantity}x {item.title}{idx < proposta.itens.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAprovar(proposta)}
                      disabled={processingPropostaId === proposta.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processingPropostaId === proposta.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openRejectDialog(proposta)}
                      disabled={processingPropostaId === proposta.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reprovar Faturamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a reprovar o faturamento da proposta de <strong>{selectedProposta?.cliente_nome}</strong>.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo da reprovação (opcional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedProposta(null);
              setRejectReason("");
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReprovar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Reprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
