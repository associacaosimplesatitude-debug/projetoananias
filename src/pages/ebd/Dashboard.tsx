import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  GraduationCap, 
  TrendingUp, 
  Award, 
  Trophy, 
  AlertCircle,
  BookOpen,
  CheckCircle,
  XCircle,
  ClipboardList
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ForcePasswordChangeDialog } from "@/components/ebd/ForcePasswordChangeDialog";

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function EBDDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Check if user needs to change default password
  const { data: profileData } = useQuery({
    queryKey: ['profile-password-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('senha_padrao_usada')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Show password dialog when senha_padrao_usada is true
  useEffect(() => {
    if (profileData?.senha_padrao_usada === true) {
      setShowPasswordDialog(true);
    }
  }, [profileData]);

  // Get the client/church ID for the superintendent
  const { data: clienteData } = useQuery({
    queryKey: ['superintendente-cliente', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('id, nome_igreja')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if user owns a church (alternative path)
  const { data: churchData } = useQuery({
    queryKey: ['owner-church', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('churches')
        .select('id, church_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !clienteData,
  });

  const churchId = churchData?.id;

  // Fetch turmas (classes) with real data
  const { data: turmas = [] } = useQuery({
    queryKey: ['ebd-turmas', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_turmas')
        .select('id, nome, faixa_etaria')
        .eq('church_id', churchId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Fetch alunos count per turma
  const { data: alunosPorTurma = [] } = useQuery({
    queryKey: ['ebd-alunos-por-turma', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_alunos')
        .select('turma_id')
        .eq('church_id', churchId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Fetch professores
  const { data: professores = [] } = useQuery({
    queryKey: ['ebd-professores', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo, turma_id')
        .eq('church_id', churchId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Fetch total alunos
  const { data: totalAlunos = 0 } = useQuery({
    queryKey: ['ebd-total-alunos', churchId],
    queryFn: async () => {
      if (!churchId) return 0;
      const { count, error } = await supabase
        .from('ebd_alunos')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!churchId,
  });

  // Fetch top 10 ranking
  const { data: ranking = [] } = useQuery({
    queryKey: ['ebd-ranking', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_alunos')
        .select('id, nome_completo, pontos_totais')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('pontos_totais', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Fetch faixas etárias
  const { data: faixasEtarias = [] } = useQuery({
    queryKey: ['ebd-faixas-etarias', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_faixas_etarias')
        .select('id, nome_faixa')
        .eq('church_id', churchId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Calculate turmas data for pie chart
  const turmasChartData = turmas.map(turma => {
    const count = alunosPorTurma.filter(a => a.turma_id === turma.id).length;
    return {
      name: turma.nome,
      value: count || 0,
    };
  }).filter(t => t.value > 0);

  // Calculate faixa etária data for pie chart
  const faixaEtariaChartData = turmas.reduce((acc, turma) => {
    const faixa = turma.faixa_etaria || 'Não definida';
    const count = alunosPorTurma.filter(a => a.turma_id === turma.id).length;
    const existing = acc.find(f => f.name === faixa);
    if (existing) {
      existing.value += count;
    } else {
      acc.push({ name: faixa, value: count });
    }
    return acc;
  }, [] as { name: string; value: number }[]).filter(f => f.value > 0);

  // Turmas with student count
  const turmasWithCount = turmas.map(turma => ({
    ...turma,
    alunosCount: alunosPorTurma.filter(a => a.turma_id === turma.id).length,
  }));

  // Ranking turmas by average points
  const rankingTurmas = turmas.map(turma => {
    const alunosDaTurma = alunosPorTurma.filter(a => a.turma_id === turma.id);
    return {
      nome: turma.nome,
      alunosCount: alunosDaTurma.length,
    };
  }).sort((a, b) => b.alunosCount - a.alunosCount);

  const getDesempenhoColor = (desempenho: string) => {
    if (desempenho === 'Ótimo') return 'text-blue-500';
    if (desempenho === 'Regular') return 'text-yellow-500';
    return 'text-red-500';
  };

  const getDesempenhoIcon = (desempenho: string) => {
    if (desempenho === 'Ótimo') return <CheckCircle className="w-4 h-4" />;
    if (desempenho === 'Regular') return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const showEmptyState = !churchId;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visão Geral do Superintendente</h1>
            <p className="text-muted-foreground">Dashboard EBD - Escola Bíblica Dominical</p>
          </div>
          <Button onClick={() => navigate("/ebd/lancamento")} className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Lançamento Manual
          </Button>
        </div>

        {/* Card 1 - Frequência Geral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Frequência Geral da EBD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Total de Alunos</p>
                <p className="text-3xl font-bold">{totalAlunos}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presentes esta Semana</p>
                <p className="text-3xl font-bold text-primary">-</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média 4 Semanas</p>
                <p className="text-3xl font-bold text-primary">-</p>
              </div>
            </div>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {showEmptyState ? (
                <p>Configure sua igreja para visualizar dados</p>
              ) : (
                <p>Lance frequências para visualizar o gráfico</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pie Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart - Turmas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Distribuição por Turma
              </CardTitle>
              <CardDescription>Alunos por turma</CardDescription>
            </CardHeader>
            <CardContent>
              {turmasChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={turmasChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {turmasChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p>Cadastre turmas e alunos para visualizar</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart - Faixa Etária */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Distribuição por Faixa Etária
              </CardTitle>
              <CardDescription>Alunos por faixa etária</CardDescription>
            </CardHeader>
            <CardContent>
              {faixaEtariaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={faixaEtariaChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#82ca9d"
                      dataKey="value"
                    >
                      {faixaEtariaChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p>Cadastre turmas e alunos para visualizar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card 2 - Turmas Ativas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Turmas Ativas
            </CardTitle>
            <CardDescription>Total: {turmas.length} turmas</CardDescription>
          </CardHeader>
          <CardContent>
            {turmasWithCount.length > 0 ? (
              <div className="space-y-4">
                {turmasWithCount.map((turma) => (
                  <div key={turma.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold">{turma.nome}</h3>
                      <p className="text-sm text-muted-foreground">
                        {turma.alunosCount} alunos • {turma.faixa_etaria}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">Ver Detalhes</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma turma cadastrada</p>
                <p className="text-sm">Cadastre turmas para começar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3 - Professores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Professores
            </CardTitle>
            <CardDescription>Total: {professores.length} professores</CardDescription>
          </CardHeader>
          <CardContent>
            {professores.length > 0 ? (
              <div className="space-y-4">
                {professores.map((prof) => (
                  <div key={prof.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold">{prof.nome_completo}</h3>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum professor cadastrado</p>
                <p className="text-sm">Cadastre professores para começar</p>
              </div>
            )}
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm"><span className="text-blue-500">●</span> Ótimo: mais de 75% da classe presente</p>
              <p className="text-sm"><span className="text-yellow-500">●</span> Regular: 50% a 75%</p>
              <p className="text-sm"><span className="text-red-500">●</span> Baixo: menos de 50%</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4 - Engajamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Engajamento dos Alunos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">-</div>
                <p className="text-sm text-muted-foreground">Acessaram Lição</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">-</div>
                <p className="text-sm text-muted-foreground">Fizeram Devocional</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">-</div>
                <p className="text-sm text-muted-foreground">Fizeram Quiz</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">-</div>
                <p className="text-sm text-muted-foreground">Ganharam Badges</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 5 - Ranking Geral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Ranking Geral da Igreja
            </CardTitle>
            <CardDescription>TOP 10 alunos (todas as turmas)</CardDescription>
          </CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <div className="space-y-2">
                {ranking.map((aluno, index) => (
                  <div key={aluno.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}º
                      </span>
                      <span className="font-medium">{aluno.nome_completo}</span>
                    </div>
                    <Badge variant="outline">{aluno.pontos_totais} pts</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum aluno no ranking ainda</p>
                <p className="text-sm">Cadastre alunos para visualizar o ranking</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 6 - Ranking entre Turmas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Ranking entre Turmas
            </CardTitle>
            <CardDescription>Por quantidade de alunos</CardDescription>
          </CardHeader>
          <CardContent>
            {rankingTurmas.length > 0 ? (
              <div className="space-y-4">
                {rankingTurmas.map((turma, index) => (
                  <div 
                    key={turma.nome}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      index === 0 ? 'bg-yellow-50 border-2 border-yellow-400 dark:bg-yellow-950' :
                      index === 1 ? 'bg-slate-50 border-2 border-slate-400 dark:bg-slate-900' :
                      index === 2 ? 'bg-amber-50 border-2 border-amber-600 dark:bg-amber-950' :
                      'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                      </span>
                      <div>
                        <h3 className="font-semibold">{turma.nome}</h3>
                        <p className="text-sm text-muted-foreground">{index + 1}º Lugar</p>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-primary">{turma.alunosCount} alunos</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma turma cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 7 - Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
              <p>Nenhum alerta no momento</p>
              <p className="text-sm">Alertas aparecerão aqui quando houver pendências</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ForcePasswordChangeDialog 
        open={showPasswordDialog} 
        onOpenChange={setShowPasswordDialog} 
      />
    </div>
  );
}
