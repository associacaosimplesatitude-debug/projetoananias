import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, Loader2, Search, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
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
import { categorizarProduto } from "@/constants/categoriasShopify";
import { isClienteRepresentante, type DescontosCategoriaRepresentante } from "@/lib/descontosShopify";

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
  // Campos de frete manual
  frete_tipo?: string | null;
  frete_transportadora?: string | null;
  frete_observacao?: string | null;
  frete_prazo_estimado?: string | null;
  // Campos Bling
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

  const handleAprovar = async (proposta: Proposta) => {
    setProcessingPropostaId(proposta.id);

    try {
      // ✅ SEMPRE buscar email do vendedor diretamente do banco (não confiar no relacionamento)
      let vendedorEmail: string | undefined = undefined;
      
      console.log("[FATURAMENTO] Iniciando busca do vendedor para proposta:", proposta.id);
      console.log("[FATURAMENTO] vendedor_id da proposta:", proposta.vendedor_id);
      
      // Buscar SEMPRE do banco para garantir que está correto
      if (proposta.vendedor_id) {
        const { data: vendedorData, error: vendedorError } = await supabase
          .from("vendedores")
          .select("id, nome, email")
          .eq("id", proposta.vendedor_id)
          .maybeSingle();
        
        if (vendedorError) {
          console.error("[FATURAMENTO] ❌ Erro ao buscar vendedor:", vendedorError);
        } else if (vendedorData) {
          vendedorEmail = vendedorData.email || undefined;
          console.log("[FATURAMENTO] ✅ Vendedor encontrado:", {
            id: vendedorData.id,
            nome: vendedorData.nome,
            email: vendedorEmail,
          });
        } else {
          console.warn("[FATURAMENTO] ⚠️ Vendedor não encontrado para ID:", proposta.vendedor_id);
        }
      } else {
        console.warn("[FATURAMENTO] ⚠️ Proposta sem vendedor_id:", proposta.id);
      }
      
      if (!vendedorEmail) {
        console.warn("[FATURAMENTO] ⚠️ Email do vendedor não determinado para proposta:", proposta.id);
      } else {
        console.log("[FATURAMENTO] 📧 Email do vendedor que será enviado ao Bling:", vendedorEmail);
      }

      const clienteProposta = proposta.cliente || {
        id: proposta.cliente_id || "",
        nome_igreja: proposta.cliente_nome,
        cnpj: proposta.cliente_cnpj || "",
        cpf: null as string | null,
        tipo_cliente: null as string | null,
        email_superintendente: null,
        telefone: null,
        nome_responsavel: proposta.cliente_nome,
        endereco_cep: proposta.cliente_endereco?.cep || null,
        endereco_rua: proposta.cliente_endereco?.rua || null,
        endereco_numero: proposta.cliente_endereco?.numero || null,
        endereco_complemento: proposta.cliente_endereco?.complemento || null,
        endereco_bairro: proposta.cliente_endereco?.bairro || null,
        endereco_cidade: proposta.cliente_endereco?.cidade || null,
        endereco_estado: proposta.cliente_endereco?.estado || null,
        pode_faturar: true,
      };

      const prazo = proposta.prazo_faturamento_selecionado || "30";
      const valorFrete = proposta.valor_frete || 0;
      const metodoFrete = proposta.metodo_frete || "COMBINAR";

      // Buscar descontos por categoria se aplicável (para qualquer cliente com faturamento)
      const clienteId = proposta.cliente_id || clienteProposta.id;
      let descontosCategoria: DescontosCategoriaRepresentante = {};
      let usarDescontoCategoria = false;

      // Buscar descontos por categoria para qualquer cliente que tenha configurado
      if (clienteId) {
        const { data: descontosData } = await supabase
          .from("ebd_descontos_categoria_representante")
          .select("categoria, percentual_desconto")
          .eq("cliente_id", clienteId);

        if (descontosData && descontosData.length > 0) {
          descontosData.forEach((d) => {
            descontosCategoria[d.categoria] = Number(d.percentual_desconto);
          });
          usarDescontoCategoria = Object.values(descontosCategoria).some(v => v > 0);
          console.log("[CAT_DESC] AprovacaoFaturamento - descontosPorCategoria:", descontosCategoria);
        }
      }

      // Validar que todos os itens têm SKU antes de processar
      const itensComSku = proposta.itens.map((item: any) => {
        const sku = item.sku || item.codigo || item.variantSku || null;
        return { ...item, sku };
      });
      
      const itensSemSku = itensComSku.filter(item => !item.sku);
      if (itensSemSku.length > 0) {
        const produtosSemSku = itensSemSku.map(i => i.title).join(", ");
        throw new Error(`Produto(s) sem SKU no carrinho/proposta: ${produtosSemSku}. Não é possível faturar sem SKU.`);
      }

      // Montar itens aplicando desconto por categoria se representante
      let valorProdutosComDesconto = 0;
      const itensBling = itensComSku.map((item) => {
        const precoOriginal = Number(item.price);
        let precoComDesconto = precoOriginal;

        if (usarDescontoCategoria) {
          // PRIORIDADE 1: Usar descontoItem que já vem salvo na proposta
          if (item.descontoItem && item.descontoItem > 0) {
            precoComDesconto = Math.round((precoOriginal * (1 - item.descontoItem / 100)) * 100) / 100;
            console.log(`[REP_DESC] Usando descontoItem da proposta: ${item.title} | Desconto: ${item.descontoItem}% | Original: ${precoOriginal} | Final: ${precoComDesconto}`);
          } else {
            // FALLBACK: Recategorizar e buscar desconto do banco
            const categoria = categorizarProduto(item.title);
            const descontoPercent = descontosCategoria[categoria] || 0;
            precoComDesconto = Math.round((precoOriginal * (1 - descontoPercent / 100)) * 100) / 100;
            console.log(`[REP_DESC] Recategorizando: ${item.title} | Categoria: ${categoria} | Desconto: ${descontoPercent}% | Original: ${precoOriginal} | Final: ${precoComDesconto}`);
          }
        } else if ((proposta.desconto_percentual || 0) > 0) {
          // Desconto global padrão
          precoComDesconto = Math.round((precoOriginal * (1 - (proposta.desconto_percentual || 0) / 100)) * 100) / 100;
        }

        valorProdutosComDesconto += precoComDesconto * item.quantity;
        const codigo = String(item.sku).trim();

        console.log(`[FATURAMENTO] Item: ${item.title} | SKU: ${codigo} | Qtd: ${item.quantity} | Valor: ${precoComDesconto}`);

        return {
          codigo,
          sku: codigo,
          descricao: item.title,
          unidade: "UN",
          quantidade: item.quantity,
          valor: precoComDesconto,
          preco_cheio: precoOriginal,
        };
      });

      const valorProdutos = Math.round(valorProdutosComDesconto * 100) / 100;
      const valorTotal = Math.round((valorProdutos + valorFrete) * 100) / 100;

      // CPF/CNPJ: não validar no front. A função bling-create-order buscará e validará
      // SEMPRE no banco (public.ebd_clientes) usando contato.id.
      const clienteBling = {
        nome: clienteProposta.nome_responsavel || clienteProposta.nome_igreja,
        sobrenome: null,
        // manter por compatibilidade, mas a fonte da verdade é o banco
        cpf_cnpj: "",
        email: clienteProposta.email_superintendente,
        telefone: clienteProposta.telefone,
      };

      const enderecoEntrega = clienteProposta.endereco_rua
        ? {
            rua: clienteProposta.endereco_rua,
            numero: clienteProposta.endereco_numero || "S/N",
            complemento: clienteProposta.endereco_complemento || "",
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
      const contatoIdSistema = proposta.cliente_id || clienteProposta.id || null;

      const { data, error } = await supabase.functions.invoke("bling-create-order", {
        body: {
          // Fonte da verdade do documento é o banco: enviar o ID do cliente do sistema
          contato: contatoIdSistema ? { id: contatoIdSistema } : undefined,
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
          // ✅ Email do vendedor para buscar o ID no Bling
          vendedor_email: vendedorEmail,
          desconto_percentual: proposta.desconto_percentual || 0,
          // Dados de frete manual
          frete_tipo: proposta.frete_tipo || 'automatico',
          frete_transportadora: proposta.frete_transportadora,
          frete_observacao: proposta.frete_observacao,
        },
      });

      // Verificar erros da função
      if (error) {
        console.error("Erro na função bling-create-order:", error);

        let msg = error.message || "Erro ao chamar função";
        const jsonMatch = msg.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            msg = parsed.error || parsed.message || msg;
          } catch {
            // ignore
          }
        }

        throw new Error(msg);
      }

      // Verificar se a resposta contém erro do Bling
      if (data?.error) {
        console.error("Erro do Bling:", data.error);
        throw new Error(data.error);
      }

      // Verificar se temos dados de sucesso do Bling
      if (!data?.success || (!data?.bling_order_id && !data?.bling_order_number)) {
        console.error("Resposta inesperada:", data);
        throw new Error("Resposta inesperada do servidor Bling");
      }

      // SUCESSO: Atualiza para FATURADO após sucesso confirmado no Bling
      // Também salvar o bling_order_number e bling_order_id na proposta
      const { error: updateError } = await supabase
        .from("vendedor_propostas")
        .update({ 
          status: "FATURADO",
          bling_order_id: data.bling_order_id || null,
          bling_order_number: data.bling_order_number?.toString() || null,
        })
        .eq("id", proposta.id);
      
      if (updateError) {
        console.error("Erro ao atualizar status:", updateError);
        throw new Error("Pedido criado no Bling mas erro ao atualizar status local");
      }

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
          // IMPORTANTE: Salvar o bling_order_id para busca de NF-e
          bling_order_id: data.bling_order_id || null,
        });
      
      if (insertError) {
        console.error("Erro ao inserir pedido para meta:", insertError);
      }

      // ============ GERAR PARCELAS PARA COMISSÃO DO VENDEDOR ============
      if (proposta.vendedor_id) {
        try {
          // Buscar comissão do vendedor
          const { data: vendedorData } = await supabase
            .from("vendedores")
            .select("comissao_percentual")
            .eq("id", proposta.vendedor_id)
            .single();
          
          const comissaoPercentual = vendedorData?.comissao_percentual || 1.5;
          
          // Configuração de parcelas baseado no prazo de faturamento
          const parcelasConfig: { [key: string]: { dias: number[]; metodos: string[] } } = {
            '30': { dias: [30], metodos: ['boleto_30'] },
            '60_direto': { dias: [60], metodos: ['boleto_60'] },
            '60': { dias: [30, 60], metodos: ['boleto_30', 'boleto_60'] },
            '60_90': { dias: [60, 90], metodos: ['boleto_60', 'boleto_90'] },
            '90': { dias: [30, 60, 90], metodos: ['boleto_30', 'boleto_60', 'boleto_90'] },
            '60_75_90': { dias: [60, 75, 90], metodos: ['boleto_60', 'boleto_75', 'boleto_90'] },
            '60_90_120': { dias: [60, 90, 120], metodos: ['boleto_60', 'boleto_90', 'boleto_120'] },
          };

          const config = parcelasConfig[prazo] || { dias: [30], metodos: ['boleto_30'] };
          const diasParcelas = config.dias;
          const metodosParcelas = config.metodos;
          const valorPorParcela = Math.round((valorTotal / diasParcelas.length) * 100) / 100;
          const comissaoPorParcela = Math.round((valorPorParcela * (comissaoPercentual / 100)) * 100) / 100;
          const dataFaturamento = new Date();

          // Usar o bling_order_number/id retornado do Bling (data), não da proposta original
          const parcelasToInsert = diasParcelas.map((dias, index) => ({
            proposta_id: proposta.id,
            vendedor_id: proposta.vendedor_id,
            cliente_id: proposta.cliente_id,
            numero_parcela: index + 1,
            total_parcelas: diasParcelas.length,
            valor: valorPorParcela,
            valor_comissao: comissaoPorParcela,
            data_vencimento: format(addDays(dataFaturamento, dias), 'yyyy-MM-dd'),
            status: 'aguardando',
            origem: 'faturado',
            metodo_pagamento: metodosParcelas[index],
            bling_order_number: data.bling_order_number?.toString() || null,
            bling_order_id: data.bling_order_id || null,
          }));

          const { error: parcelasError } = await supabase
            .from("vendedor_propostas_parcelas")
            .insert(parcelasToInsert);

          if (parcelasError) {
            console.error("Erro ao inserir parcelas:", parcelasError);
          } else {
            console.log(`[PARCELAS] ✅ ${diasParcelas.length} parcela(s) criada(s) para vendedor ${proposta.vendedor_id}`);
          }
        } catch (parcelasErr) {
          console.error("Erro ao gerar parcelas:", parcelasErr);
        }
      }
      // ============ FIM GERAR PARCELAS ============
      
      toast.success("Pedido aprovado e enviado para faturamento!", {
        description: `Prazo: ${prazo} dias • Pedido Bling: ${blingIdentifier}`,
        duration: 5000,
      });
      
      // Invalidate queries to update vendedor panel
      queryClient.invalidateQueries({ queryKey: ["vendedor-propostas-faturadas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-propostas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-vendas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-shopify-orders"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-parcelas-previsao"] });
      refetch();
    } catch (error: unknown) {
      console.error("Erro ao aprovar e faturar pedido:", error);
      
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
        });
      }
      
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

                    <div className="text-sm space-y-1">
                      <span className="text-muted-foreground">Itens:</span>
                      <div className="flex flex-wrap gap-1">
                        {proposta.itens.map((item: any, idx) => {
                          const itemSku = item.sku || item.codigo || null;
                          const hasSku = !!itemSku;
                          return (
                            <span 
                              key={idx} 
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                hasSku ? 'bg-muted' : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {item.quantity}x {item.title.length > 40 ? item.title.substring(0, 40) + '...' : item.title}
                              {hasSku ? (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  SKU: {itemSku}
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  <AlertTriangle className="w-2 h-2 mr-0.5" />
                                  SEM SKU
                                </Badge>
                              )}
                            </span>
                          );
                        })}
                      </div>
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
