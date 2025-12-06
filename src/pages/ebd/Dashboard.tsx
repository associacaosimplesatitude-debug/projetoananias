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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function EBDDashboard() {
  const navigate = useNavigate();
  // Dados mockados para demonstração
  const attendanceData = [
    { week: 'Sem 1', presentes: 85 },
    { week: 'Sem 2', presentes: 92 },
    { week: 'Sem 3', presentes: 88 },
    { week: 'Sem 4', presentes: 95 },
  ];

  const turmas = [
    { nome: 'Crianças', alunos: 22, presenca: 18, percentual: 82 },
    { nome: 'Juniores', alunos: 15, presenca: 11, percentual: 73 },
    { nome: 'Adolescentes', alunos: 32, presenca: 29, percentual: 91 },
    { nome: 'Adultos', alunos: 41, presenca: 28, percentual: 68 },
  ];

  const professores = [
    { nome: 'Prof. João Silva', alunos: 22, presenca: 18, desempenho: 'Ótimo' },
    { nome: 'Prof. Maria Santos', alunos: 15, presenca: 11, desempenho: 'Regular' },
    { nome: 'Prof. Pedro Costa', alunos: 32, presenca: 29, desempenho: 'Ótimo' },
    { nome: 'Prof. Ana Lima', alunos: 41, presenca: 28, desempenho: 'Regular' },
  ];

  const ranking = [
    { nome: 'João Pedro', pontos: 285 },
    { nome: 'Maria Clara', pontos: 272 },
    { nome: 'Lucas Santos', pontos: 268 },
    { nome: 'Ana Julia', pontos: 265 },
    { nome: 'Gabriel Silva', pontos: 258 },
    { nome: 'Isabela Costa', pontos: 255 },
    { nome: 'Miguel Alves', pontos: 248 },
    { nome: 'Laura Oliveira', pontos: 242 },
    { nome: 'Rafael Lima', pontos: 238 },
    { nome: 'Sophia Martins', pontos: 235 },
  ];

  const rankingTurmas = [
    { nome: 'Adolescentes', pontos: 98, posicao: 1 },
    { nome: 'Adultos', pontos: 92, posicao: 2 },
    { nome: 'Juniores', pontos: 88, posicao: 3 },
    { nome: 'Crianças', pontos: 82, posicao: 4 },
  ];

  const alertas = [
    { tipo: 'warning', mensagem: 'Turma Adultos com baixa presença (68%)' },
    { tipo: 'error', mensagem: 'Prof. Ana Lima não lançou presença desta semana' },
    { tipo: 'info', mensagem: 'Lição da semana ainda não publicada para Juniores' },
  ];

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
                <p className="text-3xl font-bold">110</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presentes esta Semana</p>
                <p className="text-3xl font-bold text-primary">86</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média 4 Semanas</p>
                <p className="text-3xl font-bold text-primary">90</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="presentes" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
            <div className="space-y-4">
              {turmas.map((turma) => (
                <div key={turma.nome} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold">{turma.nome}</h3>
                    <p className="text-sm text-muted-foreground">
                      {turma.alunos} alunos • Presença: {turma.presenca} ({turma.percentual}%)
                    </p>
                  </div>
                  <Button variant="outline" size="sm">Ver Detalhes</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 3 - Professores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Professores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {professores.map((prof) => (
                <div key={prof.nome} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold">{prof.nome}</h3>
                    <p className="text-sm text-muted-foreground">
                      {prof.alunos} alunos • Presença: {prof.presenca}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 ${getDesempenhoColor(prof.desempenho)}`}>
                    {getDesempenhoIcon(prof.desempenho)}
                    <Badge variant={prof.desempenho === 'Ótimo' ? 'default' : 'secondary'}>
                      {prof.desempenho}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
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
                <div className="text-3xl font-bold text-primary mb-2">78%</div>
                <p className="text-sm text-muted-foreground">Acessaram Lição</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">65%</div>
                <p className="text-sm text-muted-foreground">Fizeram Devocional</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">82%</div>
                <p className="text-sm text-muted-foreground">Fizeram Quiz</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">45%</div>
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
            <div className="space-y-2">
              {ranking.map((aluno, index) => (
                <div key={aluno.nome} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {index + 1}º
                    </span>
                    <span className="font-medium">{aluno.nome}</span>
                  </div>
                  <Badge variant="outline">{aluno.pontos} pts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 6 - Ranking entre Turmas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Ranking entre Turmas
            </CardTitle>
            <CardDescription>Média semanal por turma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rankingTurmas.map((turma) => (
                <div 
                  key={turma.nome}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    turma.posicao === 1 ? 'bg-yellow-50 border-2 border-yellow-400' :
                    turma.posicao === 2 ? 'bg-slate-50 border-2 border-slate-400' :
                    turma.posicao === 3 ? 'bg-amber-50 border-2 border-amber-600' :
                    'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">
                      {turma.posicao === 1 ? '🥇' : turma.posicao === 2 ? '🥈' : turma.posicao === 3 ? '🥉' : ''}
                    </span>
                    <div>
                      <h3 className="font-semibold">Turma {turma.nome}</h3>
                      <p className="text-sm text-muted-foreground">{turma.posicao}º Lugar</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-primary">{turma.pontos} pts</div>
                </div>
              ))}
            </div>
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
            <div className="space-y-3">
              {alertas.map((alerta, index) => (
                <div 
                  key={index}
                  className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${
                    alerta.tipo === 'error' ? 'border-red-500 bg-red-50' :
                    alerta.tipo === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <AlertCircle className={`w-5 h-5 mt-0.5 ${
                    alerta.tipo === 'error' ? 'text-red-500' :
                    alerta.tipo === 'warning' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <p className="text-sm">{alerta.mensagem}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}