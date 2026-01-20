import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
  sku?: string | null;
}

interface PropostaCliente {
  id: string;
  nome_igreja: string;
  cnpj: string | null;
  cpf: string | null;
  tipo_cliente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  nome_responsavel: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  pode_faturar: boolean;
  desconto_faturamento?: number | null;
}

interface Vendedor {
  id: string;
  nome: string;
  email?: string | null;
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
  frete_tipo?: string | null;
  frete_transportadora?: string | null;
  frete_observacao?: string | null;
  frete_prazo_estimado?: string | null;
  bling_order_id?: number | null;
  bling_order_number?: string | null;
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
            cpf,
            tipo_cliente,
            email_superintendente,
            telefone,
            nome_responsavel,
            endereco_cep,
            endereco_rua,
            endereco_numero,
            endereco_complemento,
            endereco_bairro,
            endereco_cidade,
            endereco_estado,
            pode_faturar,
            desconto_faturamento
          ),
          vendedor:vendedores(id, nome, email)
        `)
        .eq("status", "AGUARDANDO_APROVACAO_FINANCEIRA")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as Proposta[];
    },
  });

  /**
   * APROVAÇÃO ATÔMICA via Edge Function
   * 
   * Toda a lógica de aprovação (Bling, status, meta, comissões) 
   * é executada no servidor de forma atômica.
   * 
   * O frontend apenas:
   * 1. Chama a edge function
   * 2. Exibe sucesso ou erro
   * 3. Atualiza as queries
   */
  const handleAprovar = async (proposta: Proposta) => {
    setProcessingPropostaId(proposta.id);

    try {
      console.log(`[APROVAR] Iniciando aprovação atômica para proposta: ${proposta.id}`);
      console.log(`[APROVAR] Cliente: ${proposta.cliente_nome}`);
      console.log(`[APROVAR] Prazo: ${proposta.prazo_faturamento_selecionado || '30'} dias`);

      // Chamar edge function atômica
      const { data, error } = await supabase.functions.invoke("aprovar-faturamento", {
        body: {
          proposta_id: proposta.id,
        },
      });

      // Verificar erro da chamada
      if (error) {
        console.error("[APROVAR] ❌ Erro na chamada:", error);
        throw new Error(error.message || "Erro ao chamar função de aprovação");
      }

      // Verificar resposta
      if (!data?.success) {
        console.error("[APROVAR] ❌ Erro retornado:", data?.error);
        throw new Error(data?.error || "Erro desconhecido na aprovação");
      }

      // SUCESSO - A edge function executou todas as etapas
      console.log("[APROVAR] ✅ Aprovação concluída com sucesso:", data);

      toast.success("Pedido aprovado com sucesso!", {
        description: `Bling: ${data.bling_order_number || data.bling_order_id} • ${data.parcelas_criadas} parcela(s) de comissão criada(s)`,
        duration: 6000,
      });

      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["propostas-aguardando-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-propostas-faturadas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-propostas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-vendas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-shopify-orders"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-parcelas-previsao"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes-pendentes"] });
      refetch();

    } catch (error: unknown) {
      console.error("[APROVAR] ❌ Erro ao aprovar:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const isStockError = errorMessage.toLowerCase().includes("estoque insuficiente");
      
      if (isStockError) {
        toast.error("Erro de estoque no Bling", {
          description: errorMessage,
          duration: 10000,
        });
      } else {
        toast.error("Erro ao aprovar pedido", {
          description: errorMessage,
          duration: 8000,
        });
      }
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

  const formatPrazo = (prazo: string | null): string => {
    if (!prazo) return "30 dias";
    const prazoMap: Record<string, string> = {
      '30': '30 dias',
      '60_direto': '60 dias (direto)',
      '60': '30/60 dias',
      '60_90': '60/90 dias',
      '90': '30/60/90 dias',
      '60_75_90': '60/75/90 dias',
      '60_90_120': '60/90/120 dias',
    };
    return prazoMap[prazo] || `${prazo} dias`;
  };

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
                        B2B • {formatPrazo(proposta.prazo_faturamento_selecionado)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Vendedor: <strong>{proposta.vendedor?.nome || proposta.vendedor_nome || "N/A"}</strong>
                      </span>
                      {proposta.vendedor?.email && (
                        <span className="text-xs">({proposta.vendedor.email})</span>
                      )}
                      <span>
                        CNPJ/CPF: <strong>{proposta.cliente?.cnpj || proposta.cliente?.cpf || proposta.cliente_cnpj || "N/A"}</strong>
                      </span>
                      <span>
                        Criado: {format(new Date(proposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary" className="text-base font-bold">
                        R$ {proposta.valor_total?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                      {proposta.valor_frete && proposta.valor_frete > 0 && (
                        <Badge variant="outline">
                          Frete: R$ {proposta.valor_frete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </Badge>
                      )}
                      {proposta.desconto_percentual && proposta.desconto_percentual > 0 && (
                        <Badge variant="outline" className="text-green-600">
                          -{proposta.desconto_percentual}%
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {proposta.itens?.length || 0} {proposta.itens?.length === 1 ? "item" : "itens"}
                      </Badge>
                    </div>

                    {/* Itens da proposta */}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        <FileText className="inline w-4 h-4 mr-1" />
                        Ver itens da proposta
                      </summary>
                      <div className="mt-2 pl-4 space-y-1 text-sm">
                        {proposta.itens?.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.title}</span>
                            <span className="text-muted-foreground">
                              R$ {(Number(item.price) * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Endereço */}
                    {proposta.cliente?.endereco_rua && (
                      <div className="text-xs text-muted-foreground mt-2">
                        📍 {proposta.cliente.endereco_rua}, {proposta.cliente.endereco_numero}
                        {proposta.cliente.endereco_complemento && ` - ${proposta.cliente.endereco_complemento}`}
                        , {proposta.cliente.endereco_bairro} - {proposta.cliente.endereco_cidade}/{proposta.cliente.endereco_estado}
                        {proposta.cliente.endereco_cep && ` • CEP: ${proposta.cliente.endereco_cep}`}
                      </div>
                    )}
                  </div>

                  {/* Botões */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleAprovar(proposta)}
                      disabled={processingPropostaId === proposta.id}
                    >
                      {processingPropostaId === proposta.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprovar
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(proposta)}
                      disabled={processingPropostaId === proposta.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Reprovação */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Reprovar Proposta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a reprovar a proposta de <strong>{selectedProposta?.cliente_nome}</strong>.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-2">
            <label className="text-sm font-medium">Motivo da reprovação (opcional):</label>
            <Textarea
              placeholder="Informe o motivo..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleReprovar}
              disabled={processingPropostaId === selectedProposta?.id}
            >
              {processingPropostaId === selectedProposta?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Reprovando...
                </>
              ) : (
                "Confirmar Reprovação"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
