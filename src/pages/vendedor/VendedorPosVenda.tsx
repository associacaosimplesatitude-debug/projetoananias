import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Eye, MessageSquare, Rocket, ShoppingCart, Church, Mail, Phone, Key } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PedidoOnlineDetailDialog } from "@/components/admin/PedidoOnlineDetailDialog";
import { PlaybookMessageModal } from "@/components/vendedor/PlaybookMessageModal";
import { AtivarClienteDialog } from "@/components/vendedor/AtivarClienteDialog";
import { useNavigate } from "react-router-dom";

interface PosVendaItem {
  id: string;
  pedido_id: string;
  cliente_id: string | null;
  email_cliente: string;
  vendedor_id: string;
  status: string; // pendente | ativado | concluido
  created_at: string;
  // Dados do pedido (buscados separadamente)
  pedido: {
    id: string;
    order_number: string;
    shopify_order_id: number;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_document: string | null;
    valor_total: number;
    valor_frete: number;
    valor_para_meta: number;
    status_pagamento: string;
    created_at: string;
    order_date: string | null;
    codigo_rastreio: string | null;
    url_rastreio: string | null;
    endereco_rua: string | null;
    endereco_numero: string | null;
    endereco_complemento: string | null;
    endereco_bairro: string | null;
    endereco_cidade: string | null;
    endereco_estado: string | null;
    endereco_cep: string | null;
    cliente_id: string | null;
    vendedor_id: string | null;
  } | null;
  // Dados do cliente (se existir)
  cliente: {
    id: string;
    nome_igreja: string;
    nome_superintendente: string | null;
    email_superintendente: string | null;
    telefone: string | null;
    cnpj: string | null;
    cpf: string | null;
    status_ativacao_ebd: boolean;
    senha_temporaria: string | null;
  } | null;
}

export default function VendedorPosVenda() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const navigate = useNavigate();
  
  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalTitle, setMessageModalTitle] = useState("");
  const [messageModalContent, setMessageModalContent] = useState("");
  const [ativarDialogOpen, setAtivarDialogOpen] = useState(false);
  const [clienteParaAtivar, setClienteParaAtivar] = useState<any>(null);

  // Buscar do contexto de pós-venda (fonte primária: flag is_pos_venda_ecommerce no cliente; secundária: tabela pivô)
  const { data: posVendaItems = [], isLoading, refetch } = useQuery({
    queryKey: ["vendedor-pos-venda", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];

      // A) Fonte primária: clientes marcados como pós-venda e-commerce
      const { data: clientesPosVenda, error: clientesPosVendaError } = await supabase
        .from("ebd_clientes")
        .select(
          "id, nome_igreja, nome_superintendente, email_superintendente, telefone, cnpj, cpf, status_ativacao_ebd, senha_temporaria, created_at"
        )
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", false)
        .eq("is_pos_venda_ecommerce", true)
        .order("created_at", { ascending: false });

      if (clientesPosVendaError) throw clientesPosVendaError;

      // B) Fonte secundária: vínculos da tabela pivô (quando existir pedido associado)
      const { data: vinculos, error: vinculosError } = await (supabase as any)
        .from("ebd_pos_venda_ecommerce")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (vinculosError) {
        console.error("Erro ao buscar vínculos pós-venda:", vinculosError);
        // não quebrar o fluxo: ainda conseguimos listar os clientes por flag
      }

      const vinculosSafe: any[] = vinculos || [];
      const clienteIdsComVinculo = new Set(
        vinculosSafe.map((v) => v.cliente_id).filter(Boolean)
      );

      // 1) Montar itens de clientes (garantindo que SEMPRE apareçam no menu certo)
      const itensClientes: PosVendaItem[] = (clientesPosVenda || [])
        .filter((c: any) => !clienteIdsComVinculo.has(c.id))
        .map((c: any) => ({
          id: `cliente:${c.id}`,
          pedido_id: "",
          cliente_id: c.id,
          email_cliente: (c.email_superintendente || "").toLowerCase(),
          vendedor_id: vendedor.id,
          status: "pendente",
          created_at: c.created_at,
          pedido: null,
          cliente: {
            id: c.id,
            nome_igreja: c.nome_igreja,
            nome_superintendente: c.nome_superintendente,
            email_superintendente: c.email_superintendente,
            telefone: c.telefone,
            cnpj: c.cnpj,
            cpf: c.cpf,
            status_ativacao_ebd: c.status_ativacao_ebd,
            senha_temporaria: c.senha_temporaria,
          },
        }));

      // 2) Se houver vínculos, buscar pedidos/clientes e montar itens completos
      if (!vinculosSafe.length) return itensClientes;

      const pedidoIds = vinculosSafe.map((v) => v.pedido_id).filter(Boolean);
      const { data: pedidos, error: pedidosError } = pedidoIds.length
        ? await supabase.from("ebd_shopify_pedidos").select("*").in("id", pedidoIds)
        : { data: [], error: null };

      if (pedidosError) throw pedidosError;

      const clienteIds = vinculosSafe.map((v) => v.cliente_id).filter(Boolean) as string[];
      let clientes: any[] = [];
      if (clienteIds.length > 0) {
        const { data: clientesData, error: clientesError } = await supabase
          .from("ebd_clientes")
          .select(
            "id, nome_igreja, nome_superintendente, email_superintendente, telefone, cnpj, cpf, status_ativacao_ebd, senha_temporaria"
          )
          .in("id", clienteIds);

        if (clientesError) throw clientesError;
        clientes = clientesData || [];
      }

      const itensVinculos: PosVendaItem[] = vinculosSafe.map((vinculo: any) => {
        const pedido = (pedidos || []).find((p: any) => p.id === vinculo.pedido_id) || null;
        const cliente = clientes.find((c: any) => c.id === vinculo.cliente_id) || null;

        return {
          id: vinculo.id,
          pedido_id: vinculo.pedido_id,
          cliente_id: vinculo.cliente_id,
          email_cliente: vinculo.email_cliente,
          vendedor_id: vinculo.vendedor_id,
          status: vinculo.status,
          created_at: vinculo.created_at,
          pedido,
          cliente,
        };
      });

      return [...itensVinculos, ...itensClientes];
    },
    enabled: !!vendedor?.id,
  });

  const handleViewPedido = (item: PosVendaItem) => {
    if (!item.pedido) return;
    
    // Montar o objeto pedido no formato esperado pelo PedidoOnlineDetailDialog
    const pedidoForDialog = {
      ...item.pedido,
      cliente: item.cliente ? {
        nome_igreja: item.cliente.nome_igreja,
        tipo_cliente: null,
      } : null,
      vendedor: vendedor ? { nome: vendedor.nome } : null,
    };
    
    setSelectedPedido(pedidoForDialog);
    setPedidoDialogOpen(true);
  };

  const handleFazerPedido = (item: PosVendaItem) => {
    if (item.cliente_id) {
      const nomeIgreja = item.cliente?.nome_igreja || item.pedido?.customer_name || "Cliente";
      navigate(`/vendedor/shopify?clienteId=${item.cliente_id}&clienteNome=${encodeURIComponent(nomeIgreja)}`);
    } else {
      navigate(`/vendedor/shopify`);
    }
  };

  const generateBoasVindasMessage = (item: PosVendaItem) => {
    const nomeVendedor = vendedor?.nome || "Central Gospel";
    const nomeCliente = item.cliente?.nome_superintendente || item.pedido?.customer_name || "Superintendente";
    
    return `Olá ${nomeCliente}, tudo bem?
Aqui é ${nomeVendedor} da Editora Central Gospel 😊

Vi que você realizou sua compra em nossa loja e quero te agradecer pela confiança!

Além disso, você tem direito a acessar gratuitamente nosso *Painel de Gestão da EBD*, onde é possível:
• Acompanhar alunos
• Controlar aulas
• Planejar próximas compras

Se desejar, posso te ajudar a ativar agora mesmo 👍`;
  };

  const generateDadosAcessoMessage = (item: PosVendaItem) => {
    const nomeCliente = item.cliente?.nome_superintendente || item.pedido?.customer_name || "Superintendente";
    const email = item.cliente?.email_superintendente || item.pedido?.customer_email || "[E-mail não cadastrado]";
    const senha = item.cliente?.senha_temporaria || "[Será enviada após ativação]";
    const linkPainel = "https://gestaoebd.com.br/ebd/login";
    
    return `Perfeito, ${nomeCliente}!

Segue abaixo seus dados de acesso ao *Painel de Gestão EBD*:

🔗 *Acesso:* ${linkPainel}
📧 *E-mail:* ${email}
🔑 *Senha provisória:* ${senha}

Ao acessar, você poderá:
• Gerenciar alunos
• Acompanhar aulas
• Receber avisos automáticos de reposição

Qualquer dúvida, estou à disposição 😊`;
  };

  const openMessageModal = (title: string, message: string) => {
    setMessageModalTitle(title);
    setMessageModalContent(message);
    setMessageModalOpen(true);
  };

  const handleAtivarPainel = (item: PosVendaItem) => {
    if (item.cliente) {
      setClienteParaAtivar({
        id: item.cliente.id,
        cnpj: item.cliente.cnpj || "",
        nome_igreja: item.cliente.nome_igreja,
        nome_superintendente: item.cliente.nome_superintendente,
        email_superintendente: item.cliente.email_superintendente,
      });
      setAtivarDialogOpen(true);
    }
  };

  if (vendedorLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-blue-500" />
          Pós-Venda E-commerce
        </h2>
        <p className="text-muted-foreground">
          Pedidos atribuídos a você que ainda não ativaram o painel
        </p>
      </div>

      {posVendaItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum pedido pendente de pós-venda
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Pedidos atribuídos pelo gerente aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posVendaItems.map((item) => (
            <Card key={item.id} className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Church className="h-4 w-4" />
                      {item.cliente?.nome_igreja || item.pedido?.customer_name || "Cliente"}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      {(item.cliente?.nome_superintendente || item.pedido?.customer_name) && (
                        <span className="block">{item.cliente?.nome_superintendente || item.pedido?.customer_name}</span>
                      )}
                      {(item.cliente?.email_superintendente || item.pedido?.customer_email) && (
                        <span className="flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3" />
                          {item.cliente?.email_superintendente || item.pedido?.customer_email}
                        </span>
                      )}
                      {(item.cliente?.telefone || item.pedido?.customer_phone) && (
                        <span className="flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3" />
                          {item.cliente?.telefone || item.pedido?.customer_phone}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {item.pedido?.order_number ? (
                    <Badge variant="secondary" className="text-xs">
                      #{item.pedido.order_number}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Sem pedido
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Pedido em {item.pedido?.order_date ? format(new Date(item.pedido.order_date), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <p className="text-sm font-medium mb-4">
                  R$ {(item.pedido?.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openMessageModal(
                      "Mensagem de Boas-vindas",
                      generateBoasVindasMessage(item)
                    )}
                  >
                    <MessageSquare className="mr-1 h-4 w-4" />
                    Boas-vindas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openMessageModal(
                      "Enviar Acesso ao Painel",
                      generateDadosAcessoMessage(item)
                    )}
                  >
                    <Rocket className="mr-1 h-4 w-4" />
                    Enviar Acesso
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewPedido(item)}
                    disabled={!item.pedido}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    Ver Pedido
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleFazerPedido(item)}
                  >
                    <ShoppingCart className="mr-1 h-4 w-4" />
                    Criar Pedido
                  </Button>
                </div>
                
                {/* Botão Ativar Painel - Destacado */}
                <div className="mt-3 pt-3 border-t">
                  <Button 
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleAtivarPainel(item)}
                    disabled={!item.cliente}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Ativar Painel EBD
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes do Pedido */}
      <PedidoOnlineDetailDialog
        pedido={selectedPedido}
        open={pedidoDialogOpen}
        onOpenChange={(open) => {
          setPedidoDialogOpen(open);
          if (!open) setSelectedPedido(null);
        }}
        hideAttribution={true}
      />

      {/* Modal de Mensagem */}
      <PlaybookMessageModal
        open={messageModalOpen}
        onOpenChange={setMessageModalOpen}
        title={messageModalTitle}
        message={messageModalContent}
      />

      {/* Dialog de Ativação do Painel */}
      {clienteParaAtivar && (
        <AtivarClienteDialog
          open={ativarDialogOpen}
          onOpenChange={setAtivarDialogOpen}
          cliente={clienteParaAtivar}
          onSuccess={() => {
            refetch();
            setClienteParaAtivar(null);
          }}
        />
      )}
    </div>
  );
}
