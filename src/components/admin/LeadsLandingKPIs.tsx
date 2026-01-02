import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  LogIn, 
  Settings, 
  Phone, 
  Handshake, 
  DollarSign,
  Percent,
  Receipt,
  Clock,
  Target
} from "lucide-react";

interface Lead {
  id: string;
  status_kanban: string | null;
  como_conheceu: string | null;
  created_at: string;
  valor_fechamento?: number | null;
  data_fechamento?: string | null;
  vendedor_id?: string | null;
}

interface LeadsLandingKPIsProps {
  leads: Lead[];
}

export function LeadsLandingKPIs({ leads }: LeadsLandingKPIsProps) {
  // Etapas avançadas (passaram do setup)
  const etapasAposSetup = ["Contato", "Negociação", "Fechou"];
  
  // Main KPIs
  const totalCadastros = leads.length;
  const totalLogins = leads.filter(l => 
    l.status_kanban === "Logou" || 
    l.status_kanban === "Setup Preenchido" || 
    etapasAposSetup.includes(l.status_kanban || "")
  ).length;
  
  // Setup preenchido = leads que preencheram setup (com ou sem vendedor) + etapas posteriores
  const setupPreenchido = leads.filter(l => 
    l.status_kanban === "Setup Preenchido" || 
    etapasAposSetup.includes(l.status_kanban || "")
  ).length;
  
  // Aguardando atribuição = Setup preenchido SEM vendedor
  const aguardandoAtribuicao = leads.filter(l => 
    l.status_kanban === "Setup Preenchido" && !l.vendedor_id
  ).length;
  
  const contatosRealizados = leads.filter(l => 
    etapasAposSetup.includes(l.status_kanban || "")
  ).length;
  
  const negociacoes = leads.filter(l => 
    l.status_kanban === "Negociação" || l.status_kanban === "Fechou"
  ).length;
  
  const fechamentos = leads.filter(l => l.status_kanban === "Fechou").length;
  const cancelados = leads.filter(l => l.status_kanban === "Cancelado").length;
  
  const valorTotal = leads
    .filter(l => l.status_kanban === "Fechou")
    .reduce((acc, l) => acc + (l.valor_fechamento || 0), 0);

  // Strategic KPIs
  const taxaConversao = totalCadastros > 0 ? (fechamentos / totalCadastros) * 100 : 0;
  const ticketMedio = fechamentos > 0 ? valorTotal / fechamentos : 0;
  
  // Average time to close (days)
  const leadsComFechamento = leads.filter(l => l.status_kanban === "Fechou" && l.data_fechamento);
  const tempoMedio = leadsComFechamento.length > 0
    ? leadsComFechamento.reduce((acc, l) => {
        const created = new Date(l.created_at).getTime();
        const closed = new Date(l.data_fechamento!).getTime();
        return acc + (closed - created) / (1000 * 60 * 60 * 24);
      }, 0) / leadsComFechamento.length
    : 0;

  // Conversion by campaign
  const campanhas = ["Google", "YouTube", "Meta Ads"];
  const conversaoPorCampanha = campanhas.map(campanha => {
    const leadsCampanha = leads.filter(l => l.como_conheceu === campanha);
    const fechamentosCampanha = leadsCampanha.filter(l => l.status_kanban === "Fechou").length;
    const taxa = leadsCampanha.length > 0 ? (fechamentosCampanha / leadsCampanha.length) * 100 : 0;
    return { campanha, total: leadsCampanha.length, fechamentos: fechamentosCampanha, taxa };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Cadastros</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalCadastros}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-indigo-600" />
              <span className="text-xs text-muted-foreground">Logins</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalLogins}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Setup</span>
            </div>
            <p className="text-2xl font-bold mt-1">{setupPreenchido}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Contatos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{contatosRealizados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Fechamentos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{fechamentos}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Valor Total</span>
            </div>
            <p className="text-xl font-bold mt-1">{formatCurrency(valorTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategic KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-blue-700" />
              <span className="text-xs text-blue-700">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-800">{taxaConversao.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-700" />
              <span className="text-xs text-green-700">Ticket Médio</span>
            </div>
            <p className="text-xl font-bold mt-1 text-green-800">{formatCurrency(ticketMedio)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-700" />
              <span className="text-xs text-purple-700">Tempo Médio</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-purple-800">{tempoMedio.toFixed(0)} dias</p>
          </CardContent>
        </Card>

        {conversaoPorCampanha.map(({ campanha, total, taxa }) => (
          <Card key={campanha} className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-700" />
                <span className="text-xs text-orange-700">{campanha}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-orange-800">{taxa.toFixed(1)}%</p>
              <p className="text-xs text-orange-600">{total} leads</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
