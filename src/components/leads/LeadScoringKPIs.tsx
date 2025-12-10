import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, Flame, Thermometer, Snowflake, Mail } from "lucide-react";

interface LeadScoringKPIsProps {
  vendedorId?: string; // If provided, shows individual vendor stats
  isAdmin?: boolean;
}

interface LeadStats {
  total: number;
  frio: number;
  morno: number;
  quente: number;
}

interface VendedorPerformance {
  vendedor_nome: string;
  morno: number;
  quente: number;
}

export function LeadScoringKPIs({ vendedorId, isAdmin = false }: LeadScoringKPIsProps) {
  // Fetch lead stats
  const { data: leadStats, isLoading: statsLoading } = useQuery({
    queryKey: ["lead-scoring-stats", vendedorId],
    queryFn: async (): Promise<LeadStats> => {
      let query = supabase.from("ebd_leads_reativacao").select("email_aberto, conta_criada, ultimo_login_ebd");
      
      if (vendedorId) {
        query = query.eq("vendedor_id", vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const leads = data || [];
      
      // Calculate scores based on criteria:
      // Frio: conta_criada = TRUE, email_aberto = FALSE, ultimo_login_ebd = NULL
      // Morno: conta_criada = TRUE, email_aberto = TRUE, ultimo_login_ebd = NULL
      // Quente: ultimo_login_ebd IS NOT NULL (user logged in)
      let frio = 0;
      let morno = 0;
      let quente = 0;

      leads.forEach((lead) => {
        if (lead.ultimo_login_ebd) {
          quente++;
        } else if (lead.email_aberto === true) {
          morno++;
        } else {
          frio++;
        }
      });

      return {
        total: leads.length,
        frio,
        morno,
        quente,
      };
    },
  });

  // Fetch vendor performance (only for admin)
  const { data: vendorPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ["lead-scoring-vendor-performance"],
    queryFn: async (): Promise<VendedorPerformance[]> => {
      // First get all leads with vendedor_id
      const { data: leads, error: leadsError } = await supabase
        .from("ebd_leads_reativacao")
        .select("vendedor_id, email_aberto, conta_criada, ultimo_login_ebd")
        .not("vendedor_id", "is", null);

      if (leadsError) throw leadsError;

      // Get vendedor names
      const { data: vendedores, error: vendError } = await supabase
        .from("vendedores")
        .select("id, nome");

      if (vendError) throw vendError;

      // Create a map of vendedor_id to nome
      const vendedorMap = new Map<string, string>();
      vendedores?.forEach((v) => {
        vendedorMap.set(v.id, v.nome);
      });

      // Group by vendedor and count morno and quente
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

      // Convert to array with names
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

      // Sort by total (morno + quente) descending
      return result.sort((a, b) => (b.morno + b.quente) - (a.morno + a.quente));
    },
    enabled: isAdmin,
  });

  const isLoading = statsLoading || (isAdmin && perfLoading);

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

  const stats = leadStats || { total: 0, frio: 0, morno: 0, quente: 0 };

  // Pie chart data
  const pieData = [
    { name: "Frio", value: stats.frio, color: "hsl(210, 70%, 60%)" },
    { name: "Morno", value: stats.morno, color: "hsl(40, 90%, 55%)" },
    { name: "Quente", value: stats.quente, color: "hsl(0, 80%, 55%)" },
  ].filter((d) => d.value > 0);

  const calcPercentage = (value: number) => {
    if (stats.total === 0) return 0;
    return ((value / stats.total) * 100).toFixed(1);
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
              <span className="text-2xl font-bold text-blue-600">{stats.frio}</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {calcPercentage(stats.frio)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Conta criada, não abriu email
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

      {/* Charts Row */}
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
    </div>
  );
}
