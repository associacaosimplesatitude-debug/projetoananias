import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Eye, 
  Rocket, 
  ShoppingCart,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  Clock,
  Calendar,
  Church,
  Mail,
  Phone,
  RefreshCw,
  Loader2
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlaybookMessageModal } from "./PlaybookMessageModal";
import { PedidoOnlineDetailDialog } from "@/components/admin/PedidoOnlineDetailDialog";
import { AtivarClienteDialog } from "./AtivarClienteDialog";
import { useNavigate } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";
import { toast } from "sonner";

export type PlaybookType = 
  | "pos_venda" 
  | "proxima_compra" 
  | "em_risco"
  | "ativacao_pendente";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  cnpj: string | null;
  status_ativacao_ebd: boolean;
  ultimo_login: string | null;
  data_proxima_compra: string | null;
  data_inicio_ebd: string | null;
  senha_temporaria: string | null;
}

interface PlaybookClienteCardProps {
  cliente: Cliente;
  type: PlaybookType;
  onRefresh?: () => void;
}

export function PlaybookClienteCard({ cliente, type, onRefresh }: PlaybookClienteCardProps) {
  const navigate = useNavigate();
  const { vendedor } = useVendedor();
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalTitle, setMessageModalTitle] = useState("");
  const [messageModalContent, setMessageModalContent] = useState("");
  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [ativarDialogOpen, setAtivarDialogOpen] = useState(false);

  const nomeVendedor = vendedor?.nome || "Central Gospel";
  const nomeCliente = cliente.nome_superintendente || "Superintendente";

  // Fetch último pedido para pegar lista de produtos
  const { data: ultimoPedido } = useQuery({
    queryKey: ["cliente-ultimo-pedido", cliente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, order_number, valor_total, created_at")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: type === "pos_venda",
  });

  // Fetch items do pedido
  const { data: pedidoItems = [] } = useQuery({
    queryKey: ["cliente-pedido-items", ultimoPedido?.id],
    queryFn: async () => {
      if (!ultimoPedido?.id) return [];
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_itens")
        .select("product_title, quantity")
        .eq("pedido_id", ultimoPedido.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!ultimoPedido?.id && type === "pos_venda",
  });

  // Gerar mensagem de boas-vindas (pós-venda) - TEXTO PADRÃO DO PROMPT
  const generateBoasVindasMessage = () => {
    const produtosLista = pedidoItems
      .map(item => `• ${item.product_title} (${item.quantity}x)`)
      .join("\n");

    return `Olá ${nomeCliente}, tudo bem?
Aqui é ${nomeVendedor} da Editora Central Gospel 😊

Vi que você realizou sua compra em nossa loja e quero te agradecer pela confiança!

${produtosLista ? `*Você adquiriu:*\n${produtosLista}\n` : ""}
Além disso, você tem direito a acessar gratuitamente nosso *Painel de Gestão da EBD*, onde é possível:
• Acompanhar alunos
• Controlar aulas
• Planejar próximas compras

Se desejar, posso te ajudar a ativar agora mesmo 👍`;
  };

  // Gerar mensagem com dados de acesso - TEXTO PADRÃO DO PROMPT
  const generateDadosAcessoMessage = () => {
    const linkPainel = "https://gestaoebd.lovable.app/ebd/login";
    
    return `Perfeito, ${nomeCliente}!

Segue abaixo seus dados de acesso ao *Painel de Gestão EBD*:

🔗 *Acesso:* ${linkPainel}
📧 *E-mail:* ${cliente.email_superintendente || "[E-mail não cadastrado]"}
🔑 *Senha provisória:* ${cliente.senha_temporaria || "[Será enviada após ativação]"}

Ao acessar, você poderá:
• Gerenciar alunos
• Acompanhar aulas
• Receber avisos automáticos de reposição

Qualquer dúvida, estou à disposição 😊`;
  };

  // Gerar mensagem de reposição (próxima compra) - TEXTO PADRÃO DO PROMPT
  const generateReposicaoMessage = () => {
    return `Olá ${nomeCliente} 😊

Percebi que as aulas da EBD estão se aproximando do fim.

Para evitar qualquer interrupção, já podemos organizar a próxima reposição de revistas.

Posso te ajudar com isso agora?`;
  };

  // Gerar mensagem de ativação pendente
  const generateAtivacaoMessage = () => {
    return `Olá ${nomeCliente}, tudo bem?
Aqui é ${nomeVendedor} da Editora Central Gospel 😊

Gostaria de lembrar que você tem acesso gratuito ao nosso *Painel de Gestão da EBD*!

Com ele você pode:
• Acompanhar frequência dos alunos
• Gerenciar turmas e professores  
• Planejar suas aulas
• Receber lembretes de reposição

Posso te ajudar a ativar seu acesso agora?`;
  };

  // Gerar mensagem de engajamento (em risco)
  const generateEngajamentoMessage = () => {
    const diasSemLogin = cliente.ultimo_login 
      ? differenceInDays(new Date(), new Date(cliente.ultimo_login))
      : null;

    return `Olá ${nomeCliente}! 👋

${diasSemLogin === null 
  ? "Percebi que você ainda não acessou o Painel de Gestão EBD. Está tudo bem por aí?"
  : `Faz um tempo que não te vejo acessando o Painel de Gestão EBD da *${cliente.nome_igreja}*. Está tudo bem?`}

Posso te ajudar em algo?

O painel está cheio de recursos para facilitar a gestão da sua Escola Bíblica:
📊 Relatórios automáticos
👥 Controle de frequência simplificado
📚 Acompanhamento de turmas

Se precisar de ajuda para acessar ou usar alguma funcionalidade, é só me chamar!`;
  };

  const openMessageModal = (title: string, message: string) => {
    setMessageModalTitle(title);
    setMessageModalContent(message);
    setMessageModalOpen(true);
  };

  const handleFazerPedido = () => {
    navigate(`/vendedor/shopify?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

  const handleAtivarSuccess = () => {
    setAtivarDialogOpen(false);
    onRefresh?.();
  };

  // Função para buscar pedido - busca por cliente_id OU email (case insensitive)
  const handleViewOrders = async () => {
    setLoadingPedido(true);
    
    try {
      // Buscar por cliente_id OU email em uma única query
      const emailNormalized = cliente.email_superintendente?.toLowerCase().trim();
      
      let query = supabase
        .from("ebd_shopify_pedidos")
        .select(`
          *,
          cliente:ebd_clientes(nome_igreja, tipo_cliente),
          vendedor:vendedores(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(1);

      // Busca por cliente_id primeiro
      const { data: pedidosByClienteId } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          *,
          cliente:ebd_clientes(nome_igreja, tipo_cliente),
          vendedor:vendedores(nome)
        `)
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (pedidosByClienteId && pedidosByClienteId.length > 0) {
        setSelectedPedido(pedidosByClienteId[0]);
        setPedidoDialogOpen(true);
        return;
      }

      // Se não encontrar por cliente_id, busca por email
      if (emailNormalized) {
        const { data: pedidosByEmail } = await supabase
          .from("ebd_shopify_pedidos")
          .select(`
            *,
            cliente:ebd_clientes(nome_igreja, tipo_cliente),
            vendedor:vendedores(nome)
          `)
          .ilike("customer_email", emailNormalized)
          .order("created_at", { ascending: false })
          .limit(1);

        if (pedidosByEmail && pedidosByEmail.length > 0) {
          // Vincular o pedido ao cliente para futuras buscas
          await supabase
            .from("ebd_shopify_pedidos")
            .update({ cliente_id: cliente.id })
            .eq("id", pedidosByEmail[0].id);
          
          setSelectedPedido(pedidosByEmail[0]);
          setPedidoDialogOpen(true);
          return;
        }
      }

      toast.error("Nenhum pedido encontrado para este cliente");
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error("Erro ao buscar pedidos do cliente");
    } finally {
      setLoadingPedido(false);
    }
  };

  // Renderizar conteúdo baseado no tipo de playbook
  const renderCardContent = () => {
    switch (type) {
      case "pos_venda":
        return (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Cliente comprou sozinho na loja
              <br />
              Ainda não ativou o painel
              <br />
              <span className="text-amber-600">Comissão apenas na próxima compra</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openMessageModal(
                  "Mensagem de Boas-vindas",
                  generateBoasVindasMessage()
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
                  generateDadosAcessoMessage()
                )}
              >
                <Rocket className="mr-1 h-4 w-4" />
                Enviar Acesso
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOrders}
                disabled={loadingPedido}
                title="Ver último pedido do cliente"
              >
                {loadingPedido ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-1 h-4 w-4" />
                )}
                Ver Pedido
              </Button>
              <Button 
                size="sm"
                onClick={handleFazerPedido}
              >
                <ShoppingCart className="mr-1 h-4 w-4" />
                Criar Pedido
              </Button>
            </div>
          </>
        );

      case "ativacao_pendente":
        return (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Cliente já comprou, mas ainda não acessou o painel
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openMessageModal(
                  "Mensagem de Ativação",
                  generateAtivacaoMessage()
                )}
              >
                <MessageSquare className="mr-1 h-4 w-4" />
                Mensagem de Ativação
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openMessageModal(
                  "Reenviar Dados de Acesso",
                  generateDadosAcessoMessage()
                )}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Reenviar Acesso
              </Button>
              <Button 
                size="sm"
                onClick={handleFazerPedido}
              >
                <ShoppingCart className="mr-1 h-4 w-4" />
                Fazer Pedido
              </Button>
            </div>
          </>
        );

      case "proxima_compra":
        const diasRestantes = cliente.data_proxima_compra 
          ? differenceInDays(new Date(cliente.data_proxima_compra), new Date())
          : null;
        
        return (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={diasRestantes !== null && diasRestantes <= 7 ? "destructive" : diasRestantes !== null && diasRestantes <= 14 ? "secondary" : "outline"}>
                <Calendar className="mr-1 h-3 w-3" />
                {diasRestantes === null 
                  ? "Data não definida"
                  : diasRestantes < 0 
                    ? `${Math.abs(diasRestantes)} dias atrasado`
                    : diasRestantes === 0 
                      ? "Hoje!"
                      : `Faltam ${diasRestantes} dias`}
              </Badge>
              {cliente.data_proxima_compra && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(cliente.data_proxima_compra), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openMessageModal(
                  "Mensagem de Reposição",
                  generateReposicaoMessage()
                )}
              >
                <MessageSquare className="mr-1 h-4 w-4" />
                Mensagem de Reposição
              </Button>
              <Button 
                size="sm"
                onClick={handleFazerPedido}
              >
                <ShoppingCart className="mr-1 h-4 w-4" />
                Criar Pedido
              </Button>
            </div>
          </>
        );

      case "em_risco":
        const diasSemLogin = cliente.ultimo_login
          ? differenceInDays(new Date(), new Date(cliente.ultimo_login))
          : null;
        
        return (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {diasSemLogin !== null
                  ? `${diasSemLogin} dias sem login`
                  : "Nunca logou"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openMessageModal(
                  "Mensagem de Engajamento",
                  generateEngajamentoMessage()
                )}
              >
                <MessageSquare className="mr-1 h-4 w-4" />
                Mensagem de Engajamento
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleViewOrders}
                disabled={loadingPedido}
              >
                {loadingPedido ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-1 h-4 w-4" />
                )}
                Ver Atividade
              </Button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getCardBorderColor = () => {
    switch (type) {
      case "pos_venda":
        return "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20";
      case "ativacao_pendente":
        return "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20";
      case "proxima_compra":
        return "border-green-200 bg-green-50/50 dark:bg-green-950/20";
      case "em_risco":
        return "border-destructive/50 bg-destructive/5";
      default:
        return "";
    }
  };

  return (
    <>
      <Card className={getCardBorderColor()}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Church className="h-4 w-4" />
                {cliente.nome_igreja}
              </CardTitle>
              <CardDescription className="space-y-1">
                {cliente.nome_superintendente && (
                  <span className="block">{cliente.nome_superintendente}</span>
                )}
                {cliente.email_superintendente && (
                  <span className="flex items-center gap-1 text-xs">
                    <Mail className="h-3 w-3" />
                    {cliente.email_superintendente}
                  </span>
                )}
                {cliente.telefone && (
                  <span className="flex items-center gap-1 text-xs">
                    <Phone className="h-3 w-3" />
                    {cliente.telefone}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderCardContent()}
        </CardContent>
      </Card>

      {/* Modals */}
      <PlaybookMessageModal
        open={messageModalOpen}
        onOpenChange={setMessageModalOpen}
        title={messageModalTitle}
        message={messageModalContent}
      />

      <PedidoOnlineDetailDialog
        pedido={selectedPedido}
        open={pedidoDialogOpen}
        onOpenChange={(open) => {
          setPedidoDialogOpen(open);
          if (!open) setSelectedPedido(null);
        }}
        hideAttribution={true}
      />

      {/* Dialog de Ativação */}
      {cliente && (
        <AtivarClienteDialog
          open={ativarDialogOpen}
          onOpenChange={setAtivarDialogOpen}
          cliente={{
            id: cliente.id,
            cnpj: cliente.cnpj || "",
            nome_igreja: cliente.nome_igreja,
            nome_superintendente: cliente.nome_superintendente,
            email_superintendente: cliente.email_superintendente,
          }}
          onSuccess={handleAtivarSuccess}
        />
      )}
    </>
  );
}
