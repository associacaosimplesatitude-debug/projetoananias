import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Eye, MessageSquare, Rocket, ShoppingCart, Church, Mail, Phone } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PedidoOnlineDetailDialog } from "@/components/admin/PedidoOnlineDetailDialog";
import { PlaybookMessageModal } from "@/components/vendedor/PlaybookMessageModal";
import { useNavigate } from "react-router-dom";

interface PosVendaItem {
  id: string;
  pedido_id: string;
  cliente_id: string | null;
  vendedor_id: string;
  ativado: boolean;
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

  // Buscar da tabela pivô: pedidos atribuídos ao vendedor que ainda não foram ativados
  const { data: posVendaItems = [], isLoading } = useQuery({
    queryKey: ["vendedor-pos-venda", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];

      // 1. Buscar vínculos da tabela pivô
      const { data: vinculos, error: vinculosError } = await supabase
        .from("ebd_pos_venda_ecommerce")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("ativado", false)
        .order("created_at", { ascending: false });

      if (vinculosError) throw vinculosError;
      if (!vinculos || vinculos.length === 0) return [];

      // 2. Buscar os pedidos correspondentes
      const pedidoIds = vinculos.map(v => v.pedido_id);
      const { data: pedidos, error: pedidosError } = await supabase
        .from("ebd_shopify_pedidos")
        .select("*")
        .in("id", pedidoIds);

      if (pedidosError) throw pedidosError;

      // 3. Buscar os clientes correspondentes
      const clienteIds = vinculos.map(v => v.cliente_id).filter(Boolean) as string[];
      let clientes: any[] = [];
      if (clienteIds.length > 0) {
        const { data: clientesData, error: clientesError } = await supabase
          .from("ebd_clientes")
          .select("id, nome_igreja, nome_superintendente, email_superintendente, telefone, cnpj, cpf, status_ativacao_ebd, senha_temporaria")
          .in("id", clienteIds);

        if (clientesError) throw clientesError;
        clientes = clientesData || [];
      }

      // 4. Montar o resultado combinando os dados
      const result: PosVendaItem[] = vinculos.map(vinculo => {
        const pedido = pedidos?.find(p => p.id === vinculo.pedido_id) || null;
        const cliente = clientes.find(c => c.id === vinculo.cliente_id) || null;
        
        return {
          id: vinculo.id,
          pedido_id: vinculo.pedido_id,
          cliente_id: vinculo.cliente_id,
          vendedor_id: vinculo.vendedor_id,
          ativado: vinculo.ativado,
          created_at: vinculo.created_at,
          pedido,
          cliente,
        };
      });

      return result;
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
    const linkPainel = "https://gestaoebd.lovable.app/ebd/login";
    
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
                  <Badge variant="secondary" className="text-xs">
                    #{item.pedido?.order_number}
                  </Badge>
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
    </div>
  );
}
