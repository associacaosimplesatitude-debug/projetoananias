import { useState } from "react";
import { ArrowLeft, Users, GraduationCap, BookOpen, Calendar, ClipboardList, Trophy, ShoppingCart, Package, LayoutDashboard, UserCheck, Target, AlertTriangle, FileText, Calculator, Video, Settings, BarChart3, CreditCard, UserPlus, TrendingUp, Store, MessageSquare, Award, Gamepad2, BookMarked } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";

// Importar screenshots
import screenshotDashboard from "@/assets/apresentacao/screenshot-dashboard.png";
import screenshotAlunos from "@/assets/apresentacao/screenshot-alunos.png";
import screenshotProfessores from "@/assets/apresentacao/screenshot-professores.png";
import screenshotTurmas from "@/assets/apresentacao/screenshot-turmas.png";
import screenshotRevistas from "@/assets/apresentacao/screenshot-revistas.png";
import screenshotEscala from "@/assets/apresentacao/screenshot-escala.png";
import screenshotLancamento from "@/assets/apresentacao/screenshot-lancamento.png";
import screenshotFrequencia from "@/assets/apresentacao/screenshot-frequencia.png";
import screenshotQuizzes from "@/assets/apresentacao/screenshot-quizzes.png";
import screenshotDesafio from "@/assets/apresentacao/screenshot-desafio.png";
import screenshotCatalogo from "@/assets/apresentacao/screenshot-catalogo.png";
import screenshotPedidos from "@/assets/apresentacao/screenshot-pedidos.png";
import screenshotVendedorDashboard from "@/assets/apresentacao/screenshot-vendedor-dashboard.png";
import screenshotVendedorClientes from "@/assets/apresentacao/screenshot-vendedor-clientes.png";
import screenshotVendedorPdv from "@/assets/apresentacao/screenshot-vendedor-pdv.png";
import screenshotVendedorPosVenda from "@/assets/apresentacao/screenshot-vendedor-pos-venda.png";
import screenshotVendedorLeads from "@/assets/apresentacao/screenshot-vendedor-leads.png";
import screenshotVendedorAtivacao from "@/assets/apresentacao/screenshot-vendedor-ativacao.png";
import screenshotVendedorProximas from "@/assets/apresentacao/screenshot-vendedor-proximas.png";
import screenshotVendedorRisco from "@/assets/apresentacao/screenshot-vendedor-risco.png";
import screenshotVendedorNotas from "@/assets/apresentacao/screenshot-vendedor-notas.png";
import screenshotVendedorPedidos from "@/assets/apresentacao/screenshot-vendedor-pedidos.png";
import screenshotVendedorParcelas from "@/assets/apresentacao/screenshot-vendedor-parcelas.png";
import screenshotVendedorOrcamento from "@/assets/apresentacao/screenshot-vendedor-orcamento.png";
import screenshotVendedorTutoriais from "@/assets/apresentacao/screenshot-vendedor-tutoriais.png";

// Componente de Placeholder para Screenshot
const ScreenshotPlaceholder = ({ screenName }: { screenName: string }) => (
  <div className="mt-4 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden">
    <AspectRatio ratio={16 / 9}>
      <div className="w-full h-full bg-muted/50 flex items-center justify-center">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm font-medium mb-1">📸 Inserir print:</div>
          <div className="text-foreground font-semibold">{screenName}</div>
        </div>
      </div>
    </AspectRatio>
  </div>
);

// Componente para exibir Screenshot real
const ScreenshotImage = ({ src, screenName }: { src: string; screenName: string }) => (
  <div className="mt-4 border border-border rounded-lg overflow-hidden shadow-sm">
    <AspectRatio ratio={16 / 9}>
      <img 
        src={src} 
        alt={screenName} 
        className="w-full h-full object-cover object-top"
      />
    </AspectRatio>
  </div>
);

// Card de Funcionalidade
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  features: string[];
  benefits: string[];
  screenName: string;
  screenshotUrl?: string;
}

const FeatureCard = ({ icon, title, features, benefits, screenName, screenshotUrl }: FeatureCardProps) => (
  <Card className="h-full">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Funcionalidades:</h4>
        <ul className="text-sm space-y-1">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Benefícios:</h4>
        <div className="flex flex-wrap gap-1.5">
          {benefits.map((benefit, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {benefit}
            </Badge>
          ))}
        </div>
      </div>
      
      {screenshotUrl ? (
        <ScreenshotImage src={screenshotUrl} screenName={screenName} />
      ) : (
        <ScreenshotPlaceholder screenName={screenName} />
      )}
    </CardContent>
  </Card>
);

// Dados das funcionalidades do Superintendente
const superintendenteFeatures = [
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Dashboard EBD",
    features: [
      "Visão geral de alunos, professores e turmas",
      "Acompanhamento de frequência",
      "Indicadores de participação",
      "Cards de resumo da EBD"
    ],
    benefits: ["Visão completa", "Dados em tempo real", "Tomada de decisão"],
    screenName: "Dashboard EBD",
    screenshotUrl: screenshotDashboard
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Alunos",
    features: [
      "Cadastro completo de alunos",
      "Vinculação a turmas",
      "Histórico de frequência",
      "Dados de contato e responsáveis"
    ],
    benefits: ["Gestão centralizada", "Rastreabilidade", "Comunicação facilitada"],
    screenName: "Lista de Alunos",
    screenshotUrl: screenshotAlunos
  },
  {
    icon: <GraduationCap className="h-5 w-5" />,
    title: "Professores",
    features: [
      "Cadastro de professores",
      "Vinculação a turmas",
      "Dados de contato",
      "Histórico de aulas ministradas"
    ],
    benefits: ["Gestão da equipe", "Escalas facilitadas", "Reconhecimento"],
    screenName: "Lista de Professores",
    screenshotUrl: screenshotProfessores
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: "Turmas",
    features: [
      "Criação de turmas por faixa etária",
      "Vinculação de professores e alunos",
      "Configuração de horários",
      "Capacidade máxima"
    ],
    benefits: ["Organização pedagógica", "Distribuição equilibrada", "Planejamento"],
    screenName: "Gestão de Turmas",
    screenshotUrl: screenshotTurmas
  },
  {
    icon: <BookMarked className="h-5 w-5" />,
    title: "Ativar Revistas",
    features: [
      "Ativação de revistas EBD por turma",
      "Definição de período de uso",
      "Vinculação de lições ao calendário",
      "Controle de conteúdo liberado"
    ],
    benefits: ["Controle do material", "Sincronização", "Acompanhamento"],
    screenName: "Ativação de Revistas",
    screenshotUrl: screenshotRevistas
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Escala",
    features: [
      "Escala de professores por domingo",
      "Calendário visual",
      "Notificação de escala",
      "Substituições"
    ],
    benefits: ["Organização antecipada", "Transparência", "Cobertura garantida"],
    screenName: "Escala de Professores",
    screenshotUrl: screenshotEscala
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Lançamento Manual",
    features: [
      "Registro manual de presença",
      "Seleção de data e turma",
      "Marcação individual de alunos",
      "Observações por aula"
    ],
    benefits: ["Flexibilidade", "Correção de lançamentos", "Ausências justificadas"],
    screenName: "Lançamento de Presença",
    screenshotUrl: screenshotLancamento
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Frequência (Relatórios)",
    features: [
      "Relatório de frequência por período",
      "Filtros por turma e aluno",
      "Gráficos de participação",
      "Exportação de dados"
    ],
    benefits: ["Análise de engajamento", "Identificação de ausentes", "Ações de reativação"],
    screenName: "Relatórios de Frequência",
    screenshotUrl: screenshotFrequencia
  },
  {
    icon: <Gamepad2 className="h-5 w-5" />,
    title: "Quizzes",
    features: [
      "Criação de quizzes por lição",
      "Perguntas de múltipla escolha",
      "Ranking de participantes",
      "Resultados em tempo real"
    ],
    benefits: ["Gamificação", "Avaliação", "Engajamento"],
    screenName: "Quizzes EBD",
    screenshotUrl: screenshotQuizzes
  },
  {
    icon: <Trophy className="h-5 w-5" />,
    title: "Desafio Bíblico",
    features: [
      "Desafios de leitura bíblica",
      "Acompanhamento de progresso",
      "Medalhas e conquistas",
      "Ranking entre participantes"
    ],
    benefits: ["Incentivo à leitura", "Competição saudável", "Formação de hábito"],
    screenName: "Desafio Bíblico",
    screenshotUrl: screenshotDesafio
  },
  {
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "Catálogo (Loja)",
    features: [
      "Visualização de produtos disponíveis",
      "Revistas e materiais EBD",
      "Preços e descrições",
      "Adicionar ao carrinho"
    ],
    benefits: ["Acesso fácil", "Compra autônoma", "Catálogo atualizado"],
    screenName: "Catálogo de Produtos",
    screenshotUrl: screenshotCatalogo
  },
  {
    icon: <Package className="h-5 w-5" />,
    title: "Meus Pedidos",
    features: [
      "Histórico de pedidos",
      "Status de entrega",
      "Detalhes de cada compra",
      "Rastreamento"
    ],
    benefits: ["Acompanhamento", "Transparência", "Histórico completo"],
    screenName: "Meus Pedidos",
    screenshotUrl: screenshotPedidos
  }
];

// Dados das funcionalidades do Vendedor
const vendedorFeatures = [
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Painel (Dashboard)",
    features: [
      "Total de clientes na carteira",
      "Clientes pendentes de ativação",
      "Aniversariantes do mês",
      "Progresso da meta mensal",
      "Comissão prevista",
      "Segmentação da carteira"
    ],
    benefits: ["Visão completa", "Priorização de ações", "Meta em tempo real"],
    screenName: "Dashboard Vendedor",
    screenshotUrl: screenshotVendedorDashboard
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Clientes",
    features: [
      "Lista completa de clientes",
      "Busca e filtros avançados",
      "Iniciar venda direto do cliente",
      "Configurar descontos por categoria",
      "Lançamento manual de revista"
    ],
    benefits: ["Gestão completa", "Acesso rápido", "Personalização"],
    screenName: "Lista de Clientes",
    screenshotUrl: screenshotVendedorClientes
  },
  {
    icon: <Store className="h-5 w-5" />,
    title: "PDV Balcão",
    features: [
      "Busca de cliente por nome, CNPJ ou CPF",
      "Catálogo de produtos com busca",
      "Carrinho de compras intuitivo",
      "Formas de pagamento: PIX, Dinheiro, Cartão",
      "Aplicação automática de descontos"
    ],
    benefits: ["Vendas rápidas", "Integração com estoque", "Desconto automático"],
    screenName: "PDV Balcão",
    screenshotUrl: screenshotVendedorPdv
  },
  {
    icon: <UserCheck className="h-5 w-5" />,
    title: "Pós-Venda E-commerce",
    features: [
      "Lista de pedidos online atribuídos",
      "Status de ativação do cliente",
      "Mensagem de boas-vindas",
      "Ativação do cliente no sistema EBD"
    ],
    benefits: ["Conversão de compradores", "Onboarding estruturado", "Retenção"],
    screenName: "Pós-Venda E-commerce",
    screenshotUrl: screenshotVendedorPosVenda
  },
  {
    icon: <Target className="h-5 w-5" />,
    title: "Leads Landing Page",
    features: [
      "Kanban de leads (Contato, Negociação, Fechou, Cancelado)",
      "Card de lead com informações de contato",
      "Registro de valor de fechamento",
      "Motivo de perda/cancelamento"
    ],
    benefits: ["Gestão visual do funil", "Conversão", "Histórico"],
    screenName: "Kanban de Leads",
    screenshotUrl: screenshotVendedorLeads
  },
  {
    icon: <UserPlus className="h-5 w-5" />,
    title: "Ativação Pendente",
    features: [
      "Lista de clientes aguardando ativação",
      "Informações de contato (email, telefone)",
      "Botão de ativar cliente",
      "Senha temporária visível"
    ],
    benefits: ["Ninguém sem acesso", "Processo simplificado"],
    screenName: "Ativação Pendente",
    screenshotUrl: screenshotVendedorAtivacao
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Próximas Compras",
    features: [
      "Clientes com revistas próximas do fim",
      "Data prevista de próxima compra",
      "Card com informações para contato",
      "Mensagem de abordagem sugerida"
    ],
    benefits: ["Vendas proativas", "Previsibilidade", "Recorrência"],
    screenName: "Próximas Compras",
    screenshotUrl: screenshotVendedorProximas
  },
  {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: "Clientes em Risco",
    features: [
      "Lista de clientes sem login há 30+ dias",
      "Informações de último acesso",
      "Card de contato rápido",
      "Mensagem de reativação sugerida"
    ],
    benefits: ["Prevenção de churn", "Identificação precoce"],
    screenName: "Clientes em Risco",
    screenshotUrl: screenshotVendedorRisco
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Notas Emitidas",
    features: [
      "Lista de notas fiscais emitidas",
      "Número da NF-e e chave de acesso",
      "Link para PDF da nota",
      "Envio via WhatsApp"
    ],
    benefits: ["Controle fiscal", "Reenvio facilitado"],
    screenName: "Notas Fiscais Emitidas",
    screenshotUrl: screenshotVendedorNotas
  },
  {
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "Pedidos",
    features: [
      "Aba 'Nova Venda' - criar pedido",
      "Aba 'Minhas Propostas' - acompanhar",
      "Aplicação de descontos",
      "Geração de link de proposta",
      "Status (Pendente, Aceita, Faturado, Pago)"
    ],
    benefits: ["Fluxo digital", "Proposta profissional", "Tempo real"],
    screenName: "Gestão de Pedidos",
    screenshotUrl: screenshotVendedorPedidos
  },
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: "Minhas Parcelas",
    features: [
      "Lista de parcelas a receber (comissões)",
      "Filtro por mês e status",
      "Valor total a receber",
      "Detalhamento por cliente"
    ],
    benefits: ["Previsibilidade", "Controle financeiro pessoal"],
    screenName: "Minhas Parcelas",
    screenshotUrl: screenshotVendedorParcelas
  },
  {
    icon: <Calculator className="h-5 w-5" />,
    title: "Orçamento Transportadora",
    features: [
      "Seleção de cliente e endereço",
      "Busca e adição de produtos",
      "Cálculo automático de peso e volume",
      "Seleção de local de coleta",
      "Conversão em proposta"
    ],
    benefits: ["Precisão no frete", "Agilidade", "Histórico"],
    screenName: "Calculadora de Frete",
    screenshotUrl: screenshotVendedorOrcamento
  },
  {
    icon: <Video className="h-5 w-5" />,
    title: "Tutoriais",
    features: [
      "Vídeos de treinamento por categoria",
      "Reprodução direta na plataforma"
    ],
    benefits: ["Capacitação contínua", "Autonomia"],
    screenName: "Tutoriais",
    screenshotUrl: screenshotVendedorTutoriais
  }
];

// Dados das funcionalidades do Gerente/Admin
const gerenteFeatures = [
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Dashboard de Vendas",
    features: [
      "KPIs de vendas em tempo real",
      "Canais: E-commerce, Igreja CNPJ/CPF, Marketplaces",
      "Gráfico de evolução de vendas",
      "Ranking de vendedores com meta",
      "Filtros por período"
    ],
    benefits: ["Visão 360°", "Metas em tempo real", "Top performers"],
    screenName: "Dashboard Admin EBD"
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Propostas Digitais",
    features: [
      "Central de propostas com status",
      "Visualização detalhada",
      "Filtros por vendedor e status",
      "Histórico completo"
    ],
    benefits: ["Rastreabilidade", "Gestão centralizada"],
    screenName: "Propostas Digitais"
  },
  {
    icon: <Package className="h-5 w-5" />,
    title: "Pedidos por Canal",
    features: [
      "Pedidos Central Gospel (e-commerce)",
      "Pedidos Igreja CPF e CNPJ",
      "Pedidos ADVECS e Atacado",
      "Marketplaces: Amazon, Shopee, Mercado Livre"
    ],
    benefits: ["Visão segmentada", "Canais performáticos"],
    screenName: "Pedidos por Canal"
  },
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: "Aprovação de Faturamento",
    features: [
      "Lista de pedidos aguardando liberação",
      "Análise de crédito",
      "Aprovação/Rejeição"
    ],
    benefits: ["Controle financeiro", "Redução de inadimplência"],
    screenName: "Aprovação de Faturamento"
  },
  {
    icon: <Award className="h-5 w-5" />,
    title: "Gestão de Comissões",
    features: [
      "Comissões de vendedores e gerentes",
      "Royalties de autores",
      "Filtros por status e vendedor",
      "Detalhamento por operação"
    ],
    benefits: ["Controle preciso", "Transparência", "Gestão hierárquica"],
    screenName: "Gestão de Comissões"
  },
  {
    icon: <UserPlus className="h-5 w-5" />,
    title: "Atribuição de Clientes",
    features: [
      "Pedidos sem vendedor atribuído",
      "Atribuição automática por email",
      "Filtros e busca"
    ],
    benefits: ["Ninguém sem atendimento", "Distribuição inteligente"],
    screenName: "Atribuição de Clientes"
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Gestão de Clientes EBD",
    features: [
      "Lista completa de clientes",
      "Filtros por vendedor, estado, status",
      "Edição e transferência",
      "Visualização de progresso de revistas"
    ],
    benefits: ["Gestão centralizada", "Identificação de oportunidades"],
    screenName: "Clientes EBD"
  },
  {
    icon: <Target className="h-5 w-5" />,
    title: "Leads de Reativação",
    features: [
      "Importação via planilha",
      "Score de leads (Quente, Morno, Frio)",
      "Status e atribuição a vendedores",
      "Leads de Landing Page"
    ],
    benefits: ["Recuperação de inativos", "Priorização inteligente"],
    screenName: "Leads de Reativação"
  },
  {
    icon: <Settings className="h-5 w-5" />,
    title: "Gestão de Vendedores",
    features: [
      "Cadastro de vendedores e representantes",
      "Tipo de perfil e comissão",
      "Meta mensal e gerente responsável",
      "Flag 'Trabalha na Loja Penha'",
      "Visualizar como vendedor"
    ],
    benefits: ["Gestão completa", "Flexibilidade", "Hierarquia"],
    screenName: "Gestão de Vendedores"
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Transferências",
    features: [
      "Solicitações de transferência",
      "Aprovação/Rejeição",
      "Histórico completo"
    ],
    benefits: ["Processo organizado", "Auditoria"],
    screenName: "Transferências de Clientes"
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: "Catálogo EBD (Admin)",
    features: [
      "Gestão de revistas e lições",
      "Quizzes e conteúdo bíblico",
      "Integração Shopify"
    ],
    benefits: ["Gestão do portfólio", "Sincronização automática"],
    screenName: "Catálogo Admin"
  },
  {
    icon: <Video className="h-5 w-5" />,
    title: "Gestão de Tutoriais",
    features: [
      "Upload de vídeos",
      "Organização por categoria",
      "Acesso para vendedores e clientes"
    ],
    benefits: ["Treinamento escalável", "Suporte em vídeo"],
    screenName: "Gestão de Tutoriais"
  }
];

export default function Apresentacao() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("superintendente");

  return (
    <div className="min-h-screen bg-background">
      {/* Header Fixo */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold">Sistema EBD - Guia Completo</h1>
                <p className="text-sm text-muted-foreground">
                  Todas as ferramentas para gestão, vendas e acompanhamento
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Badge variant="outline">37 Funcionalidades</Badge>
              <Badge variant="outline">3 Painéis</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="superintendente" className="text-xs sm:text-sm">
              <BookOpen className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Superintendente
            </TabsTrigger>
            <TabsTrigger value="vendedor" className="text-xs sm:text-sm">
              <Store className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Vendedor
            </TabsTrigger>
            <TabsTrigger value="gerente" className="text-xs sm:text-sm">
              <Settings className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Administração
            </TabsTrigger>
          </TabsList>

          {/* Seção Superintendente */}
          <TabsContent value="superintendente" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Painel do Superintendente</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Gestão completa da Escola Bíblica Dominical: alunos, professores, turmas, frequência, 
                quizzes, desafios e compras de materiais.
              </p>
              <Badge className="mt-3">12 Funcionalidades</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {superintendenteFeatures.map((feature, idx) => (
                <FeatureCard key={idx} {...feature} />
              ))}
            </div>
          </TabsContent>

          {/* Seção Vendedor */}
          <TabsContent value="vendedor" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Painel do Vendedor</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ferramentas completas para gestão de carteira, vendas presenciais e online, 
                acompanhamento de metas e comissões.
              </p>
              <Badge className="mt-3">13 Funcionalidades</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendedorFeatures.map((feature, idx) => (
                <FeatureCard key={idx} {...feature} />
              ))}
            </div>
          </TabsContent>

          {/* Seção Gerente */}
          <TabsContent value="gerente" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Painel Administrativo</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Visão gerencial completa: dashboard de vendas, gestão de equipe, comissões, 
                aprovações e controle de todo o negócio.
              </p>
              <Badge className="mt-3">12 Funcionalidades</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gerenteFeatures.map((feature, idx) => (
                <FeatureCard key={idx} {...feature} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sistema EBD - Gestão completa para sua Escola Bíblica Dominical
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            37 funcionalidades distribuídas em 3 painéis especializados
          </p>
        </div>
      </footer>
    </div>
  );
}
