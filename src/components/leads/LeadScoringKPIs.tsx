import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, Flame, Thermometer, Snowflake, Mail, UserX, TrendingDown } from "lucide-react";

interface LeadScoringKPIsProps {
  vendedorId?: string; // If provided, shows individual vendor stats
  isAdmin?: boolean;
}

interface LeadStats {
  total: number;
  frioComEmail: number;
  frioSemEmail: number;
  morno: number;
  quente: number;
}

interface VendedorPerformance {
  vendedor_nome: string;
  morno: number;
  quente: number;
}

interface StatusStats {
  naoContatado: number;
  emNegociacao: number;
  reativado: number;
  perdido: number;
  total: number;
}

interface MotivoPerdaStats {
  motivo: string;
  count: number;
}

export function LeadScoringKPIs({ vendedorId, isAdmin = false }: LeadScoringKPIsProps) {
  // Fetch lead stats
  const { data: leadStats, isLoading: statsLoading } = useQuery({
    queryKey: ["lead-scoring-stats", vendedorId],
    queryFn: async (): Promise<LeadStats> => {
      let query = supabase.from("ebd_leads_reativacao").select("email, email_aberto, conta_criada, ultimo_login_ebd");
      
      if (vendedorId) {
        query = query.eq("vendedor_id", vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const leads = data || [];
      
      let frioComEmail = 0;
      let frioSemEmail = 0;
      let morno = 0;
      let quente = 0;

      leads.forEach((lead) => {
        if (lead.ultimo_login_ebd) {
          quente++;
        } else if (lead.email_aberto === true) {
          morno++;
        } else if (lead.email) {
          frioComEmail++;
        } else {
          frioSemEmail++;
        }
      });

      return {
        total: leads.length,
        frioComEmail,
        frioSemEmail,
        morno,
        quente,
      };
    },
  });

  // Fetch status distribution stats
  const { data: statusStats, isLoading: statusLoading } = useQuery({
    queryKey: ["lead-status-stats", vendedorId],
    queryFn: async (): Promise<StatusStats> => {
      let query = supabase.from("ebd_leads_reativacao").select("status_lead");
      
      if (vendedorId) {
        query = query.eq("vendedor_id", vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const leads = data || [];
      
      let naoContatado = 0;
      let emNegociacao = 0;
      let reativado = 0;
      let perdido = 0;

      leads.forEach((lead) => {
        const status = lead.status_lead?.toLowerCase() || '';
        if (status === 'não contatado' || status === 'nao contatado') {
          naoContatado++;
        } else if (status === 'em negociação' || status === 'em negociacao') {
          emNegociacao++;
        } else if (status === 'reativado') {
          reativado++;
        } else if (status === 'perdido') {
          perdido++;
        } else {
          // Default to não contatado for unknown statuses
          naoContatado++;
        }
      });

      return {
        naoContatado,
        emNegociacao,
        reativado,
        perdido,
        total: leads.length,
      };
    },
  });

  // Fetch motivo da perda stats
  const { data: motivoPerdaStats, isLoading: motivoLoading } = useQuery({
    queryKey: ["lead-motivo-perda-stats", vendedorId],
    queryFn: async (): Promise<MotivoPerdaStats[]> => {
      let query = supabase
        .from("ebd_leads_reativacao")
        .select("motivo_perda")
        .eq("status_lead", "Perdido")
        .not("motivo_perda", "is", null);
      
      if (vendedorId) {
        query = query.eq("vendedor_id", vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const leads = data || [];
      
      // Count by motivo
      const motivoMap = new Map<string, number>();
      const validMotivos = ['Concorrência', 'Preço', 'Logística', 'Igreja Fechou', 'Sem Interesse', 'Outro'];
      
      leads.forEach((lead) => {
        const motivo = lead.motivo_perda || 'Outro';
        const normalizedMotivo = validMotivos.find(m => 
          m.toLowerCase() === motivo.toLowerCase()
        ) || 'Outro';
        
        motivoMap.set(normalizedMotivo, (motivoMap.get(normalizedMotivo) || 0) + 1);
      });

      // Convert to array and sort by count
      const result: MotivoPerdaStats[] = [];
      motivoMap.forEach((count, motivo) => {
        result.push({ motivo, count });
      });

      return result.sort((a, b) => b.count - a.count);
    },
  });

  // Fetch vendor performance (only for admin)
  const { data: vendorPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ["lead-scoring-vendor-performance"],
    queryFn: async (): Promise<VendedorPerformance[]> => {
      const { data: leads, error: leadsError } = await supabase
        .from("ebd_leads_reativacao")
        .select("vendedor_id, email_aberto, conta_criada, ultimo_login_ebd")
        .not("vendedor_id", "is", null);

      if (leadsError) throw leadsError;

      const { data: vendedores, error: vendError } = await supabase
        .from("vendedores")
        .select("id, nome");

      if (vendError) throw vendError;

      const vendedorMap = new Map<string, string>();
      vendedores?.forEach((v) => {
        vendedorMap.set(v.id, v.nome);
      });

      const performanceMap = new Map<string, { morno: number; quente: number }>();

      leads?.forEach((lead: any) => {
        if (!lead.vendedor_id) return;
        
        if (!performanceMap.has(lead.vendedor_id)) {
          performanceMap.set(lead.vendedor_id, { morno: 0, quente: 0 });
        }

        const stats = performanceMap.get(lead.vendedor_id)!;
        
        if (lead.ultimo_login_ebd) {
          stats.quente++;
        } else if (lead.email_aberto === true) {
          stats.morno++;
        }
      });

      const result: VendedorPerformance[] = [];
      performanceMap.forEach((stats, vendedorId) => {
        const nome = vendedorMap.get(vendedorId) || "Desconhecido";
        if (stats.morno > 0 || stats.quente > 0) {
          result.push({
            vendedor_nome: nome,
            morno: stats.morno,
            quente: stats.quente,
          });
        }
      });

      return result.sort((a, b) => (b.morno + b.quente) - (a.morno + a.quente));
    },
    enabled: isAdmin,
  });

  const isLoading = statsLoading || statusLoading || motivoLoading || (isAdmin && perfLoading);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="py-8">
              <div className="animate-pulse h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = leadStats || { total: 0, frioComEmail: 0, frioSemEmail: 0, morno: 0, quente: 0 };
  const totalFrio = stats.frioComEmail + stats.frioSemEmail;
  const status = statusStats || { naoContatado: 0, emNegociacao: 0, reativado: 0, perdido: 0, total: 0 };

  // Pie chart data for score distribution
  const pieData = [
    { name: "Frio", value: totalFrio, color: "hsl(210, 70%, 60%)" },
    { name: "Morno", value: stats.morno, color: "hsl(40, 90%, 55%)" },
    { name: "Quente", value: stats.quente, color: "hsl(0, 80%, 55%)" },
  ].filter((d) => d.value > 0);

  // Pie chart data for status distribution
  const statusPieData = [
    { name: "Não Contatado", value: status.naoContatado, color: "hsl(210, 15%, 60%)" },
    { name: "Em Negociação", value: status.emNegociacao, color: "hsl(210, 70%, 55%)" },
    { name: "Reativado", value: status.reativado, color: "hsl(142, 70%, 45%)" },
    { name: "Perdido", value: status.perdido, color: "hsl(0, 70%, 55%)" },
  ].filter((d) => d.value > 0);

  // Bar chart data for motivo da perda
  const motivoPerdaData = motivoPerdaStats || [];

  // Colors for motivo da perda
  const motivoColors: Record<string, string> = {
    'Concorrência': 'hsl(0, 70%, 55%)',
    'Preço': 'hsl(30, 80%, 55%)',
    'Logística': 'hsl(210, 70%, 55%)',
    'Igreja Fechou': 'hsl(270, 60%, 55%)',
    'Sem Interesse': 'hsl(180, 60%, 45%)',
    'Outro': 'hsl(0, 0%, 50%)',
  };

  const calcPercentage = (value: number, total: number = stats.total) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className="text-xl font-semibold">Lead Scoring - Reativação EBD</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isAdmin ? "Total de Leads Churn" : "Leads Atribuídos"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Na base de reativação" : "Na sua carteira"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Frios</CardTitle>
            <Snowflake className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600">{totalFrio}</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {calcPercentage(totalFrio)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">{stats.frioComEmail}</span> com email, <span className="text-red-500 font-medium">{stats.frioSemEmail}</span> sem email
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Mornos</CardTitle>
            <Thermometer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">{stats.morno}</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                {calcPercentage(stats.morno)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Abriu email, aguardando ativação
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Quentes</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-600">{stats.quente}</span>
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {calcPercentage(stats.quente)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Logou no painel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 - Score Distribution and Vendor Performance / Action Card */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pie Chart - Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Score</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.total === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Nenhum lead encontrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Action Card for Vendedor / Bar Chart for Admin */}
        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por Vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              {!vendorPerformance || vendorPerformance.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  Nenhum dado de vendedor encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={vendorPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--foreground))" />
                    <YAxis 
                      type="category" 
                      dataKey="vendedor_nome" 
                      width={100} 
                      stroke="hsl(var(--foreground))"
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))' 
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="morno" name="Mornos" fill="hsl(40, 90%, 55%)" stackId="a" />
                    <Bar dataKey="quente" name="Quentes" fill="hsl(0, 80%, 55%)" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base text-amber-700 dark:text-amber-300">
                Ação Imediata
              </CardTitle>
              <Mail className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-700 dark:text-amber-300 mb-2">
                {stats.morno}
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Leads <strong>Mornos</strong> abriram o email!
              </p>
              <p className="text-xs text-amber-500 dark:text-amber-500 mt-2">
                Priorize o contato com esses leads - eles demonstraram interesse ao abrir o email de reativação.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 2 - Status Distribution and Motivo da Perda */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pie Chart - Status Distribution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Status do Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.total === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Nenhum lead encontrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${value} (${calcPercentage(value, status.total)}%)`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-status-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} leads`, '']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Motivo da Perda */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Motivo da Perda
            </CardTitle>
            <Badge variant="outline" className="text-red-600 border-red-300">
              {status.perdido} perdidos
            </Badge>
          </CardHeader>
          <CardContent>
            {motivoPerdaData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <div className="text-center">
                  <UserX className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum lead perdido</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={motivoPerdaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--foreground))" />
                  <YAxis 
                    type="category" 
                    dataKey="motivo" 
                    width={100} 
                    stroke="hsl(var(--foreground))"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Bar 
                    dataKey="count" 
                    name="Leads Perdidos"
                    radius={[0, 4, 4, 0]}
                  >
                    {motivoPerdaData.map((entry, index) => (
                      <Cell 
                        key={`cell-motivo-${index}`} 
                        fill={motivoColors[entry.motivo] || motivoColors['Outro']} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
