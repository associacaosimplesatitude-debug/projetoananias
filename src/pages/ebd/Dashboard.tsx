import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  GraduationCap, 
  TrendingUp, 
  Award, 
  Trophy, 
  BookOpen,
  ClipboardList,
  DollarSign,
  Cake,
  CalendarDays,
  Star,
  Target,
  Crown,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ForcePasswordChangeDialog } from "@/components/ebd/ForcePasswordChangeDialog";
import { format, subWeeks, startOfWeek, endOfWeek, isToday, isSameMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  useEffect(() => {
    if (profileData?.senha_padrao_usada === true) {
      setShowPasswordDialog(true);
    }
  }, [profileData]);

  // Get the church ID for the superintendent
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
    enabled: !!user?.id,
  });

  const churchId = churchData?.id;

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

  // Fetch total professores
  const { data: totalProfessores = 0 } = useQuery({
    queryKey: ['ebd-total-professores', churchId],
    queryFn: async () => {
      if (!churchId) return 0;
      const { count, error } = await supabase
        .from('ebd_professores')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!churchId,
  });

  // Fetch turmas
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

  // Fetch frequência das últimas 4 semanas
  const { data: frequenciaData } = useQuery({
    queryKey: ['ebd-frequencia-4semanas', churchId],
    queryFn: async () => {
      if (!churchId) return { totalPresencas: 0, totalEsperado: 0, mediaFrequencia: 0 };
      
      const fourWeeksAgo = subWeeks(new Date(), 4);
      
      const { data, error } = await supabase
        .from('ebd_frequencia')
        .select('presente, data')
        .eq('church_id', churchId)
        .gte('data', format(fourWeeksAgo, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      const totalPresencas = data?.filter(f => f.presente).length || 0;
      const totalLancamentos = data?.length || 0;
      const mediaFrequencia = totalLancamentos > 0 ? Math.round((totalPresencas / totalLancamentos) * 100) : 0;
      
      return { totalPresencas, totalEsperado: totalLancamentos, mediaFrequencia };
    },
    enabled: !!churchId,
  });

  // Fetch dados de aula (ofertas)
  const { data: ofertasData } = useQuery({
    queryKey: ['ebd-ofertas', churchId],
    queryFn: async () => {
      if (!churchId) return { saldoTotal: 0, turmaTopArrecadadora: null };
      
      const { data, error } = await supabase
        .from('ebd_dados_aula')
        .select('turma_id, valor_ofertas')
        .eq('church_id', churchId);
      
      if (error) throw error;
      
      const saldoTotal = data?.reduce((sum, d) => sum + (d.valor_ofertas || 0), 0) || 0;
      
      // Agrupar por turma
      const ofertasPorTurma: Record<string, number> = {};
      data?.forEach(d => {
        if (d.turma_id) {
          ofertasPorTurma[d.turma_id] = (ofertasPorTurma[d.turma_id] || 0) + (d.valor_ofertas || 0);
        }
      });
      
      // Encontrar turma com mais arrecadação
      let topTurmaId: string | null = null;
      let topValor = 0;
      Object.entries(ofertasPorTurma).forEach(([turmaId, valor]) => {
        if (valor > topValor) {
          topValor = valor;
          topTurmaId = turmaId;
        }
      });
      
      return { saldoTotal, topTurmaId, topValor };
    },
    enabled: !!churchId,
  });

  // Fetch alunos com dados completos para aniversariantes e ranking
  const { data: alunosData = [] } = useQuery({
    queryKey: ['ebd-alunos-full', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_alunos')
        .select('id, nome_completo, pontos_totais, data_nascimento, avatar_url, turma_id')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('pontos_totais', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Fetch planejamento de revistas
  const { data: planejamentos = [] } = useQuery({
    queryKey: ['ebd-planejamentos', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          data_inicio,
          data_termino,
          revista:ebd_revistas(id, titulo, num_licoes, imagem_url)
        `)
        .eq('church_id', churchId)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  // Fetch frequência histórica (últimos 6 meses)
  const { data: frequenciaHistorica = [] } = useQuery({
    queryKey: ['ebd-frequencia-historica', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      
      const sixMonthsAgo = subMonths(new Date(), 6);
      
      const { data, error } = await supabase
        .from('ebd_frequencia')
        .select('presente, data')
        .eq('church_id', churchId)
        .gte('data', format(sixMonthsAgo, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Agrupar por mês
      const frequenciaPorMes: Record<string, { presentes: number; total: number }> = {};
      
      data?.forEach(f => {
        const mes = format(new Date(f.data), 'MMM/yy', { locale: ptBR });
        if (!frequenciaPorMes[mes]) {
          frequenciaPorMes[mes] = { presentes: 0, total: 0 };
        }
        frequenciaPorMes[mes].total++;
        if (f.presente) {
          frequenciaPorMes[mes].presentes++;
        }
      });
      
      return Object.entries(frequenciaPorMes).map(([mes, dados]) => ({
        mes,
        frequencia: dados.total > 0 ? Math.round((dados.presentes / dados.total) * 100) : 0,
      }));
    },
    enabled: !!churchId,
  });

  // Calcular aniversariantes
  const today = new Date();
  const aniversariantesHoje = alunosData.filter(a => {
    if (!a.data_nascimento) return false;
    const nascimento = new Date(a.data_nascimento);
    return nascimento.getDate() === today.getDate() && nascimento.getMonth() === today.getMonth();
  });

  const aniversariantesMes = alunosData.filter(a => {
    if (!a.data_nascimento) return false;
    const nascimento = new Date(a.data_nascimento);
    return nascimento.getMonth() === today.getMonth();
  });

  // Top 10 ranking
  const ranking = alunosData.slice(0, 10);

  // Nome da turma para exibição
  const getTurmaNome = (turmaId: string) => {
    const turma = turmas.find(t => t.id === turmaId);
    return turma?.nome || 'Turma';
  };

  // Calcular progresso de revistas em uso
  const revistasEmUso = planejamentos
    .filter(p => {
      const dataTermino = new Date(p.data_termino);
      return dataTermino >= today;
    })
    .map(p => {
      const revista = p.revista as any;
      if (!revista) return null;
      
      const dataInicio = new Date(p.data_inicio);
      const dataTermino = new Date(p.data_termino);
      const totalLicoes = revista.num_licoes || 13;
      
      // Calcular semanas passadas
      const semanasPassadas = Math.floor((today.getTime() - dataInicio.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const licoesMinistradas = Math.min(Math.max(0, semanasPassadas), totalLicoes);
      const progresso = Math.round((licoesMinistradas / totalLicoes) * 100);
      
      return {
        titulo: revista.titulo,
        imagem_url: revista.imagem_url,
        progresso,
        licoesMinistradas,
        totalLicoes,
      };
    })
    .filter(Boolean);

  const showEmptyState = !churchId;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Dashboard do Superintendente</h1>
            <p className="text-muted-foreground">
              {churchData?.church_name || 'Escola Bíblica Dominical'}
            </p>
          </div>
          <Button onClick={() => navigate("/ebd/lancamento")} className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Lançamento Manual
          </Button>
        </div>

        {/* Micro-KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total de Alunos */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Alunos</p>
                  <p className="text-3xl font-bold text-blue-600">{totalAlunos}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total de Professores */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Professores</p>
                  <p className="text-3xl font-bold text-green-600">{totalProfessores}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total de Turmas */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Turmas Ativas</p>
                  <p className="text-3xl font-bold text-purple-600">{turmas.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Taxa de Frequência */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Frequência Média</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {frequenciaData?.mediaFrequencia || 0}%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Target className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segunda linha de widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Aniversariantes do Dia */}
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cake className="h-5 w-5 text-pink-600" />
                Aniversariantes do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aniversariantesHoje.length > 0 ? (
                <div className="space-y-2">
                  {aniversariantesHoje.slice(0, 3).map(aluno => (
                    <div key={aluno.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={aluno.avatar_url || undefined} />
                        <AvatarFallback className="bg-pink-500/20 text-pink-600 text-xs">
                          {aluno.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{aluno.nome_completo}</span>
                    </div>
                  ))}
                  {aniversariantesHoje.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{aniversariantesHoje.length - 3} mais
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum aniversariante hoje</p>
              )}
            </CardContent>
          </Card>

          {/* Saldo em Caixa */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Saldo em Caixa (Ofertas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                R$ {(ofertasData?.saldoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {ofertasData?.topTurmaId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Top arrecadação: {getTurmaNome(ofertasData.topTurmaId)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Aniversariantes do Mês */}
          <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-5 w-5 text-violet-600" />
                Aniversariantes do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aniversariantesMes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {aniversariantesMes.slice(0, 5).map(aluno => (
                    <Avatar key={aluno.id} className="h-8 w-8 border-2 border-violet-500/30">
                      <AvatarImage src={aluno.avatar_url || undefined} />
                      <AvatarFallback className="bg-violet-500/20 text-violet-600 text-xs">
                        {aluno.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {aniversariantesMes.length > 5 && (
                    <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-medium text-violet-600">
                      +{aniversariantesMes.length - 5}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum aniversariante este mês</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revistas em Uso e Ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revistas em Uso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Revistas em Uso
              </CardTitle>
              <CardDescription>Evolução do planejamento trimestral</CardDescription>
            </CardHeader>
            <CardContent>
              {revistasEmUso.length > 0 ? (
                <div className="space-y-4">
                  {revistasEmUso.map((revista: any, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate flex-1">{revista.titulo}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {revista.licoesMinistradas}/{revista.totalLicoes} aulas
                        </span>
                      </div>
                      <Progress value={revista.progresso} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum planejamento ativo</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/ebd/planejamento')}>
                    Criar Planejamento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ranking de Alunos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Alunos
              </CardTitle>
              <CardDescription>Top 10 por pontuação</CardDescription>
            </CardHeader>
            <CardContent>
              {ranking.length > 0 ? (
                <div className="space-y-3">
                  {ranking.map((aluno, index) => (
                    <div key={aluno.id} className="flex items-center gap-3">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={aluno.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {aluno.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{aluno.nome_completo}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-semibold">{aluno.pontos_totais}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum aluno cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Frequência Histórica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução da Frequência
            </CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            {frequenciaHistorica.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={frequenciaHistorica}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Frequência']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="frequencia" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Lance frequências para visualizar o gráfico</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Turma */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Distribuição por Turma
              </CardTitle>
            </CardHeader>
            <CardContent>
              {turmas.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={turmas.map(t => {
                        const count = alunosData.filter(a => a.turma_id === t.id).length;
                        return { name: t.nome, value: count };
                      }).filter(t => t.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {turmas.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p>Cadastre turmas para visualizar</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Turmas com contagem */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Turmas Ativas
              </CardTitle>
              <CardDescription>{turmas.length} turmas cadastradas</CardDescription>
            </CardHeader>
            <CardContent>
              {turmas.length > 0 ? (
                <div className="space-y-3">
                  {turmas.slice(0, 6).map(turma => {
                    const alunosCount = alunosData.filter(a => a.turma_id === turma.id).length;
                    return (
                      <div key={turma.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{turma.nome}</p>
                          <p className="text-xs text-muted-foreground">{turma.faixa_etaria}</p>
                        </div>
                        <Badge variant="secondary">{alunosCount} alunos</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma turma cadastrada</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/ebd/turmas')}>
                    Cadastrar Turma
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ForcePasswordChangeDialog 
        open={showPasswordDialog} 
        onOpenChange={setShowPasswordDialog}
      />
    </div>
  );
}
