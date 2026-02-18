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
  Gamepad2,
  Gift,
  Wallet,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ForcePasswordChangeDialog } from "@/components/ebd/ForcePasswordChangeDialog";
import { OnboardingProgressCard } from "@/components/ebd/OnboardingProgressCard";
import { TaxaLeituraSemanalCard } from "@/components/ebd/TaxaLeituraSemanalCard";
import { BirthdayCouponModal } from "@/components/ebd/BirthdayCouponModal";
import { useBirthdayCheck } from "@/hooks/useBirthdayCheck";
import { useEbdCreditos } from "@/hooks/useEbdCreditos";
import { format, subWeeks, startOfWeek, endOfWeek, isToday, isSameMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ['#f4b328', '#e09a1a', '#c7850f', '#a87010', '#8a5c0d', '#6d490a', '#f4c958', '#f4d878'];

// Saudação baseada na hora do dia
function getSaudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default function EBDDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const { birthdayInfo, refetch: refetchBirthday } = useBirthdayCheck();

  // Queries and data processing logic

  // Revendedor não deve acessar o dashboard do superintendente
  const { data: ebdClienteTipo, isLoading: ebdClienteTipoLoading } = useQuery({
    queryKey: ["ebd-cliente-tipo-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("tipo_cliente")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .limit(1);
      if (error) return null;
      return data && data.length > 0 ? data[0].tipo_cliente : null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (ebdClienteTipoLoading) return;
    if (ebdClienteTipo === "REVENDEDOR") {
      navigate("/ebd/shopify-pedidos", { replace: true });
    }
  }, [ebdClienteTipo, ebdClienteTipoLoading, navigate]);

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

  const { data: ebdClienteData } = useQuery({
    queryKey: ['ebd-cliente-onboarding', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('id, nome_igreja')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!user?.id,
  });

  const { data: superRoleChurch } = useQuery({
    queryKey: ['super-role-church', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: roleData, error: roleError } = await supabase
        .from('ebd_user_roles')
        .select('church_id')
        .eq('user_id', user.id)
        .eq('role', 'superintendente')
        .limit(1);
      if (roleError || !roleData || roleData.length === 0) return null;
      const roleChurchId = roleData[0].church_id;
      const { data: church } = await supabase
        .from('churches')
        .select('id, church_name')
        .eq('id', roleChurchId)
        .maybeSingle();
      if (church) return church;
      const { data: ebdCliente } = await supabase
        .from('ebd_clientes')
        .select('id, nome_igreja')
        .eq('id', roleChurchId)
        .maybeSingle();
      if (ebdCliente) {
        return { id: ebdCliente.id, church_name: ebdCliente.nome_igreja };
      }
      return null;
    },
    enabled: !!user?.id,
  });

  const churchId = churchData?.id || superRoleChurch?.id || ebdClienteData?.id;
  const churchName =
    churchData?.church_name ||
    superRoleChurch?.church_name ||
    ebdClienteData?.nome_igreja ||
    'Escola Bíblica Dominical';

  const ebdClienteId = ebdClienteData?.id || null;
  const { totalDisponivel: creditosDisponiveis, totalUsado: creditosUsados } = useEbdCreditos(ebdClienteId);

  useEffect(() => {
    if (birthdayInfo?.shouldShowModal) {
      setShowBirthdayModal(true);
    }
  }, [birthdayInfo]);

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
      const ofertasPorTurma: Record<string, number> = {};
      data?.forEach(d => {
        if (d.turma_id) {
          ofertasPorTurma[d.turma_id] = (ofertasPorTurma[d.turma_id] || 0) + (d.valor_ofertas || 0);
        }
      });
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

  const { data: professorData } = useQuery({
    queryKey: ['superintendente-professor', user?.id, churchId],
    queryFn: async () => {
      if (!user?.id || !churchId) return null;
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo, church_id, turma_id, avatar_url')
        .eq('user_id', user.id)
        .eq('church_id', churchId)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: !!user?.id && !!churchId,
  });

  const { data: escalasSuper = [] } = useQuery({
    queryKey: ['superintendente-escalas', professorData?.id, professorData?.church_id],
    queryFn: async () => {
      if (!professorData?.id) return [];
      const { data: escalasData, error } = await supabase
        .from('ebd_escalas')
        .select(`*, turma:ebd_turmas(id, nome, faixa_etaria)`)
        .or(`professor_id.eq.${professorData.id},professor_id_2.eq.${professorData.id}`)
        .gte('data', format(new Date(), 'yyyy-MM-dd'))
        .order('data', { ascending: true })
        .limit(10);
      if (error) return [];
      const professorIds = new Set<string>();
      escalasData.forEach(e => {
        if (e.professor_id) professorIds.add(e.professor_id);
        if (e.professor_id_2) professorIds.add(e.professor_id_2);
      });
      if (professorIds.size === 0) return escalasData.map(e => ({ ...e, professor: null, professor2: null }));
      const { data: professoresData } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo, avatar_url')
        .in('id', Array.from(professorIds))
        .eq('church_id', professorData.church_id);
      const professoresMap = new Map(professoresData?.map(p => [p.id, p]) || []);
      return escalasData.map(escala => ({
        ...escala,
        professor: escala.professor_id ? professoresMap.get(escala.professor_id) : null,
        professor2: escala.professor_id_2 ? professoresMap.get(escala.professor_id_2) : null,
      }));
    },
    enabled: !!professorData?.id,
  });

  const proximaEscala = escalasSuper[0] || null;

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

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const aniversariantesHoje = alunosData.filter(a => {
    if (!a.data_nascimento) return false;
    const [year, month, day] = String(a.data_nascimento).split("-").map(Number);
    return day === todayDay && month === todayMonth;
  });

  const aniversariantesMes = alunosData.filter(a => {
    if (!a.data_nascimento) return false;
    const [, month] = String(a.data_nascimento).split("-").map(Number);
    return month === todayMonth;
  });

  const ranking = alunosData.slice(0, 10);

  const getTurmaNome = (turmaId: string) => {
    const turma = turmas.find(t => t.id === turmaId);
    return turma?.nome || 'Turma';
  };

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
    <div className="space-y-6">
      {/* Header Premium - único bloco escuro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-[#1b191c] border border-[#f4b328]/20">
        <div>
          <p className="text-[#f4b328]/70 text-sm font-medium tracking-wide uppercase">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
            {getSaudacao()}, <span className="text-[#f4b328]">Superintendente</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-[#f4b328]/20 text-[#f4b328] border-[#f4b328]/30 hover:bg-[#f4b328]/30">
              {churchName}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => navigate("/ebd/lancamento-manual")} 
            className="gap-2 bg-[#f4b328] text-[#1b191c] hover:bg-[#f4b328]/90 font-semibold"
          >
            <ClipboardList className="h-4 w-4" />
            Lançamento Manual
          </Button>
          <Button 
            onClick={() => navigate("/ebd/desafio-biblico")} 
            variant="outline" 
            className="gap-2 border-white/20 text-white hover:bg-white/10 hover:text-white"
          >
            <Gamepad2 className="h-4 w-4" />
            Desafio Bíblico
          </Button>
        </div>
      </div>

      {/* Card de Onboarding/Gamificação */}
      {!ebdClienteTipo?.toLowerCase().includes("advec") && (
        <OnboardingProgressCard churchId={ebdClienteId} />
      )}

      {/* Card de Créditos Disponíveis */}
      {(creditosDisponiveis > 0 || creditosUsados > 0) && (
        <Card className="border-gray-200 bg-white rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[#f4b328]/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-[#f4b328]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Créditos Disponíveis</p>
                  <p className="text-2xl font-bold text-[#f4b328]">
                    R$ {creditosDisponiveis.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Já utilizados</p>
                <p className="text-sm font-medium text-gray-500">
                  R$ {creditosUsados.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards - Fundo branco, clean */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total de Alunos */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total de Alunos</p>
                <p className="text-3xl font-bold text-gray-900">{totalAlunos}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#f4b328]/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-[#f4b328]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total de Professores */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Professores</p>
                <p className="text-3xl font-bold text-gray-900">{totalProfessores}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#f4b328]/10 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-[#f4b328]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total de Turmas */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Turmas Ativas</p>
                <p className="text-3xl font-bold text-gray-900">{turmas.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#f4b328]/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-[#f4b328]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Frequência */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Frequência Média</p>
                <p className="text-3xl font-bold text-gray-900">
                  {frequenciaData?.mediaFrequencia || 0}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#f4b328]/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-[#f4b328]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Taxa de Leitura Semanal */}
      <TaxaLeituraSemanalCard churchId={churchId} />

      {/* Cards de Escala para Superintendente que é Professor */}
      {professorData && escalasSuper.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Minha Escala - Próxima Aula */}
          {proximaEscala && (
            <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                  <Calendar className="h-5 w-5 text-[#f4b328]" />
                  Minha Escala
                </CardTitle>
                <CardDescription className="text-gray-400">Sua próxima aula como professor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-lg bg-amber-50 flex flex-col items-center justify-center">
                    <span className="text-xs text-[#f4b328] font-medium">
                      {format(new Date(proximaEscala.data + 'T00:00:00'), 'MMM', { locale: ptBR }).toUpperCase()}
                    </span>
                    <span className="text-xl font-bold text-[#f4b328]">
                      {format(new Date(proximaEscala.data + 'T00:00:00'), 'dd')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{(proximaEscala.turma as any)?.nome || 'Aula'}</p>
                    <p className="text-sm text-gray-500">
                      {(proximaEscala.turma as any)?.faixa_etaria || 'Turma'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(proximaEscala.data + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Professores:</span>
                  <div className="flex -space-x-2">
                    {proximaEscala.professor && (
                      <Avatar className="h-7 w-7 border-2 border-white">
                        <AvatarImage src={proximaEscala.professor.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#f4b328]/10 text-[#f4b328] text-xs">
                          {proximaEscala.professor.nome_completo?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {proximaEscala.professor2 && (
                      <Avatar className="h-7 w-7 border-2 border-white">
                        <AvatarImage src={proximaEscala.professor2.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#f4b328]/10 text-[#f4b328] text-xs">
                          {proximaEscala.professor2.nome_completo?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {proximaEscala.professor?.nome_completo?.split(' ')[0]}
                    {proximaEscala.professor2 && ` e ${proximaEscala.professor2.nome_completo?.split(' ')[0]}`}
                  </span>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={() => navigate('/ebd/escala')}
                >
                  Ver Escala Completa
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Card Próximas Aulas */}
          <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                <ClipboardList className="h-5 w-5 text-[#f4b328]" />
                Próximas Aulas
              </CardTitle>
              <CardDescription className="text-gray-400">Sua agenda como professor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {escalasSuper.slice(0, 4).map((escala: any) => (
                  <div key={escala.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="h-10 w-10 rounded bg-amber-50 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#f4b328] font-medium">
                        {format(new Date(escala.data + 'T00:00:00'), 'MMM', { locale: ptBR }).toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-[#f4b328]">
                        {format(new Date(escala.data + 'T00:00:00'), 'dd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-900">
                        {escala.turma?.nome || 'Aula'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {escala.turma?.faixa_etaria || 'Turma'}
                      </p>
                    </div>
                    <div className="flex -space-x-1">
                      {escala.professor && (
                        <Avatar className="h-6 w-6 border border-white">
                          <AvatarImage src={escala.professor.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-[#f4b328]/10 text-[#f4b328]">
                            {escala.professor.nome_completo?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {escala.professor2 && (
                        <Avatar className="h-6 w-6 border border-white">
                          <AvatarImage src={escala.professor2.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-[#f4b328]/10 text-[#f4b328]">
                            {escala.professor2.nome_completo?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {escalasSuper.length > 4 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-3 gap-2 text-[#f4b328] hover:bg-amber-50 hover:text-[#f4b328]"
                  onClick={() => navigate('/ebd/escala')}
                >
                  Ver todas ({escalasSuper.length} aulas)
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Segunda linha de widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Aniversariantes do Dia */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <Cake className="h-5 w-5 text-[#f4b328]" />
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
                      <AvatarFallback className="bg-[#f4b328]/10 text-[#f4b328] text-xs">
                        {aluno.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate text-gray-900">{aluno.nome_completo}</span>
                  </div>
                ))}
                {aniversariantesHoje.length > 3 && (
                  <p className="text-xs text-gray-400">
                    +{aniversariantesHoje.length - 3} mais
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhum aniversariante hoje</p>
            )}
          </CardContent>
        </Card>

        {/* Saldo em Caixa */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <DollarSign className="h-5 w-5 text-[#f4b328]" />
              Saldo em Caixa (Ofertas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              R$ {(ofertasData?.saldoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            {ofertasData?.topTurmaId && (
              <p className="text-xs text-gray-400 mt-1">
                Top arrecadação: {getTurmaNome(ofertasData.topTurmaId)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Aniversariantes do Mês */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <CalendarDays className="h-5 w-5 text-[#f4b328]" />
              Aniversariantes do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aniversariantesMes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {aniversariantesMes.slice(0, 5).map(aluno => (
                  <Avatar key={aluno.id} className="h-8 w-8 border-2 border-gray-100">
                    <AvatarImage src={aluno.avatar_url || undefined} />
                    <AvatarFallback className="bg-[#f4b328]/10 text-[#f4b328] text-xs">
                      {aluno.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {aniversariantesMes.length > 5 && (
                  <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center text-xs font-medium text-[#f4b328]">
                    +{aniversariantesMes.length - 5}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhum aniversariante este mês</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revistas em Uso e Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revistas em Uso */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <BookOpen className="h-5 w-5 text-[#f4b328]" />
              Revistas em Uso
            </CardTitle>
            <CardDescription className="text-gray-400">Evolução do planejamento trimestral</CardDescription>
          </CardHeader>
          <CardContent>
            {revistasEmUso.length > 0 ? (
              <div className="space-y-4">
                {revistasEmUso.map((revista: any, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1 text-gray-900">{revista.titulo}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {revista.licoesMinistradas}/{revista.totalLicoes} aulas
                      </span>
                    </div>
                    <Progress value={revista.progresso} className="h-2 bg-gray-100" indicatorClassName="bg-[#f4b328]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum planejamento ativo</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 border-gray-200 text-gray-700 hover:bg-gray-50" 
                  onClick={() => navigate('/ebd/planejamento')}
                >
                  Criar Planejamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking de Alunos */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Trophy className="h-5 w-5 text-[#f4b328]" />
              Ranking de Alunos
            </CardTitle>
            <CardDescription className="text-gray-400">Top 10 por pontuação</CardDescription>
          </CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <div className="space-y-3">
                {ranking.map((aluno, index) => (
                  <div key={aluno.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-gradient-to-br from-[#f4b328] to-[#e09a1a] text-[#1b191c] shadow-md shadow-[#f4b328]/30' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                      index === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={aluno.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-[#f4b328]/10 text-[#f4b328]">
                        {aluno.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-900">{aluno.nome_completo}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-[#f4b328]" />
                      <span className="text-sm font-semibold text-[#f4b328]">{aluno.pontos_totais}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum aluno cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Frequência Histórica */}
      <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <TrendingUp className="h-5 w-5 text-[#f4b328]" />
            Evolução da Frequência
          </CardTitle>
          <CardDescription className="text-gray-400">Últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          {frequenciaHistorica.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={frequenciaHistorica}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="mes" stroke="rgb(156,163,175)" tick={{ fill: 'rgb(156,163,175)', fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="rgb(156,163,175)" tick={{ fill: 'rgb(156,163,175)', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Frequência']}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#111827'
                  }}
                  labelStyle={{ color: '#6b7280' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="frequencia" 
                  stroke="#f4b328" 
                  strokeWidth={3}
                  dot={{ fill: '#f4b328', strokeWidth: 2, stroke: '#fff', r: 5 }}
                  activeDot={{ r: 7, fill: '#f4b328', stroke: '#f4b328', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
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
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <GraduationCap className="h-5 w-5 text-[#f4b328]" />
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
                    fill="#f4b328"
                    dataKey="value"
                  >
                    {turmas.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: '#111827'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                <p>Cadastre turmas para visualizar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Turmas com contagem */}
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="h-5 w-5 text-[#f4b328]" />
              Turmas Ativas
            </CardTitle>
            <CardDescription className="text-gray-400">{turmas.length} turmas cadastradas</CardDescription>
          </CardHeader>
          <CardContent>
            {turmas.length > 0 ? (
              <div className="space-y-3">
                {turmas.slice(0, 6).map(turma => {
                  const alunosCount = alunosData.filter(a => a.turma_id === turma.id).length;
                  return (
                    <div key={turma.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{turma.nome}</p>
                        <p className="text-xs text-gray-400">{turma.faixa_etaria}</p>
                      </div>
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                        {alunosCount} alunos
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma turma cadastrada</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 border-gray-200 text-gray-700 hover:bg-gray-50" 
                  onClick={() => navigate('/ebd/turmas')}
                >
                  Cadastrar Turma
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ForcePasswordChangeDialog 
        open={showPasswordDialog} 
        onOpenChange={setShowPasswordDialog}
      />

      {/* Modal de Aniversário com Cupom */}
      {birthdayInfo && (
        <BirthdayCouponModal
          open={showBirthdayModal}
          onOpenChange={setShowBirthdayModal}
          clienteId={birthdayInfo.clienteId}
          nomeCliente={birthdayInfo.nomeCliente}
          tipoAniversario={birthdayInfo.tipoAniversario}
          onCouponRedeemed={() => refetchBirthday()}
        />
      )}
    </div>
  );
}
