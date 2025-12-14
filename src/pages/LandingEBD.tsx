import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  ClipboardList, 
  MessageCircle, 
  BarChart3, 
  Users, 
  CheckCircle2,
  Star,
  Trophy,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Clock,
  ArrowRight,
  Church
} from 'lucide-react';

import logoGestaoEBD from '@/assets/landing/logo-gestao-ebd.png';
import dashboardNotebook from '@/assets/landing/dashboard-notebook.png';
import rankingAlunos from '@/assets/landing/ranking-alunos.png';
import listaProfessores from '@/assets/landing/lista-professores.png';
import catalogoMateriais from '@/assets/landing/catalogo-materiais.png';

const LandingEBD = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nomeIgreja: '',
    nomeResponsavel: '',
    email: '',
    telefone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nomeIgreja || !formData.nomeResponsavel || !formData.email || !formData.telefone) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Call edge function to create account instantly
      const { data, error } = await supabase.functions.invoke('ebd-instant-signup', {
        body: {
          nomeIgreja: formData.nomeIgreja,
          nomeResponsavel: formData.nomeResponsavel,
          email: formData.email,
          telefone: formData.telefone
        }
      });

      if (error) throw error;

      if (data?.userAlreadyExists) {
        toast.info('Você já possui uma conta! Faça login para acessar o painel.');
        navigate('/login/ebd');
        return;
      }

      // Log in the user automatically with the temporary password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: 'mudar123'
      });

      if (signInError) {
        toast.error('Conta criada! Faça login com a senha: mudar123');
        navigate('/login/ebd');
        return;
      }

      toast.success('Conta criada com sucesso! Redirecionando...');
      navigate('/ebd/dashboard');
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);
      toast.error(error?.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' });
  };

  const problems = [
    { icon: ClipboardList, title: 'Controle de Frequência Manual', description: 'Cadernos, planilhas perdidas e dificuldade em acompanhar quem está presente.' },
    { icon: MessageCircle, title: 'Comunicação Descentralizada', description: 'Informações espalhadas em grupos de WhatsApp sem organização.' },
    { icon: BarChart3, title: 'Falta de Visão Estratégica', description: 'Sem métricas claras sobre crescimento, engajamento e resultados.' },
    { icon: Users, title: 'Gestão de Professores Desorganizada', description: 'Dificuldade em acompanhar escalas, materiais e desempenho dos professores.' }
  ];

  const features = [
    {
      title: 'Painel do Superintendente',
      subtitle: 'Visão Estratégica Completa',
      description: 'Tenha todos os dados da sua EBD em um só lugar. KPIs em tempo real, gestão de turmas e relatórios detalhados.',
      image: dashboardNotebook,
      items: ['KPIs em Tempo Real (Alunos, Professores, Turmas, Frequência)', 'Gestão Completa de Turmas', 'Relatórios Detalhados e Exportáveis']
    },
    {
      title: 'Gestão de Professores',
      subtitle: 'Capacitação e Acompanhamento',
      description: 'Cada professor tem sua área exclusiva para lançar frequência, acessar materiais e se comunicar com a turma.',
      image: listaProfessores,
      items: ['Área Exclusiva para Cada Professor', 'Lançamento de Frequência Simplificado', 'Comunicação Direta com Turmas']
    },
    {
      title: 'Ranking e Engajamento',
      subtitle: 'Gamificação que Motiva',
      description: 'Sistema de pontuação e ranking que incentiva a participação e o engajamento dos alunos.',
      image: rankingAlunos,
      items: ['Ficha de Aluno Digital Completa', 'Histórico de Frequência e Participação', 'Gamificação com Ranking de Pontos']
    },
    {
      title: 'Catálogo de Materiais',
      subtitle: 'Tudo Organizado',
      description: 'Acesse e gerencie todos os materiais didáticos organizados por faixa etária.',
      image: catalogoMateriais,
      items: ['Acesso a Revistas EBD', 'Materiais Organizados por Faixa Etária', 'Integração com Catálogo de Ofertas']
    }
  ];

  const testimonials = [
    { name: 'Pr. João Silva', role: 'Superintendente - AD Central', quote: 'O Gestão EBD transformou nossa escola dominical. Hoje temos controle total e nossos professores amam a facilidade.' },
    { name: 'Diac. Maria Santos', role: 'Superintendente - IB Nova Vida', quote: 'Finalmente conseguimos acompanhar o crescimento dos alunos e ter métricas reais do nosso trabalho.' },
    { name: 'Pr. Carlos Oliveira', role: 'Pastor Titular - Igreja Batista', quote: 'Uma ferramenta indispensável. E o melhor: é gratuita! Recomendo para todas as igrejas.' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logoGestaoEBD} alt="Gestão EBD" className="h-10 md:h-12" />
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate('/login/ebd')}
              className="border-[#FFC107] text-black hover:bg-[#FFC107]/10 font-medium"
            >
              Acessar Painel
            </Button>
            <Button 
              onClick={scrollToForm}
              className="bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold"
            >
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-[#FFC107]/10 text-[#B8860B] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                100% GRATUITO PARA SEMPRE
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-black leading-tight mb-6">
                REVOLUCIONE SUA{' '}
                <span className="text-[#FFC107]">ESCOLA BÍBLICA DOMINICAL</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                A plataforma completa de gestão que sua EBD precisava para crescer, engajar e multiplicar o conhecimento. 
                <strong className="text-black"> Sem custos. Sem pegadinhas.</strong>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  onClick={scrollToForm}
                  className="bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold text-lg px-8 py-6 shadow-lg shadow-[#FFC107]/30"
                >
                  COMECE AGORA. É GRÁTIS! <ArrowRight className="ml-2" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#FFC107]/20 to-transparent rounded-3xl blur-2xl" />
              <img 
                src={dashboardNotebook} 
                alt="Dashboard do Gestão EBD" 
                className="relative w-full rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Sua EBD ainda luta contra a <span className="text-[#FFC107]">desorganização?</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Muitas igrejas enfrentam os mesmos desafios. A boa notícia? Existe solução.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((problem, index) => (
              <Card key={index} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                <CardContent className="p-6">
                  <problem.icon className="w-12 h-12 text-[#FFC107] mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">{problem.title}</h3>
                  <p className="text-gray-400 text-sm">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 bg-[#FFC107]">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-black text-[#FFC107] px-6 py-3 rounded-full text-lg font-bold mb-6">
            <CheckCircle2 className="w-6 h-6" />
            SIM, É GRATUITO!
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-black mb-4">
            A tecnologia que multiplica o Reino
          </h2>
          <p className="text-black/80 max-w-2xl mx-auto text-lg">
            Acreditamos que a tecnologia não deve ser uma barreira para o crescimento do Reino. 
            Por isso, o Gestão EBD é 100% gratuito. Centralize toda a administração da sua EBD em uma única plataforma.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
              O que você ganha <span className="text-[#FFC107]">de graça</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Conheça as funcionalidades que vão transformar a gestão da sua Escola Bíblica Dominical.
            </p>
          </div>
          <div className="space-y-24">
            {features.map((feature, index) => (
              <div key={index} className={`grid lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                <div className={`${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <div className="bg-[#FFC107]/10 text-[#B8860B] px-4 py-2 rounded-full text-sm font-medium inline-block mb-4">
                    {feature.subtitle}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-black mb-4">{feature.title}</h3>
                  <p className="text-gray-600 mb-6">{feature.description}</p>
                  <ul className="space-y-3">
                    {feature.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#FFC107] flex-shrink-0" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-r from-[#FFC107]/20 to-transparent rounded-3xl blur-xl" />
                    <img 
                      src={feature.image} 
                      alt={feature.title} 
                      className="relative w-full rounded-2xl shadow-xl border border-gray-200"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
              Igrejas que já <span className="text-[#FFC107]">transformaram</span> sua EBD
            </h2>
          </div>
          
          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <Church className="w-12 h-12 text-[#FFC107] mx-auto mb-4" />
              <div className="text-4xl font-black text-black mb-2">500+</div>
              <div className="text-gray-600">Igrejas Cadastradas</div>
            </div>
            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <GraduationCap className="w-12 h-12 text-[#FFC107] mx-auto mb-4" />
              <div className="text-4xl font-black text-black mb-2">10.000+</div>
              <div className="text-gray-600">Alunos Gerenciados</div>
            </div>
            <div className="text-center p-8 bg-gray-50 rounded-2xl">
              <Trophy className="w-12 h-12 text-[#FFC107] mx-auto mb-4" />
              <div className="text-4xl font-black text-black mb-2">98%</div>
              <div className="text-gray-600">Taxa de Satisfação</div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-2 border-gray-100 hover:border-[#FFC107] transition-colors">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-[#FFC107] text-[#FFC107]" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-6 italic">"{testimonial.quote}"</p>
                  <div>
                    <div className="font-bold text-black">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="formulario" className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Pare de gerenciar. <span className="text-[#FFC107]">Comece a crescer.</span>
              </h2>
              <p className="text-gray-400">
                Não perca mais tempo com planilhas e burocracia. Junte-se a centenas de igrejas que já estão usando o Gestão EBD para focar no crescimento espiritual e numérico.
              </p>
            </div>

            <Card className="bg-white border-0">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome da Igreja *
                      </label>
                      <Input
                        placeholder="Ex: Igreja Batista Central"
                        value={formData.nomeIgreja}
                        onChange={(e) => setFormData({ ...formData, nomeIgreja: e.target.value })}
                        className="h-12"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Responsável *
                      </label>
                      <Input
                        placeholder="Seu nome completo"
                        value={formData.nomeResponsavel}
                        onChange={(e) => setFormData({ ...formData, nomeResponsavel: e.target.value })}
                        className="h-12"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        E-mail *
                      </label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="h-12"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Telefone / WhatsApp *
                      </label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        className="h-12"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold text-lg h-14"
                  >
                    {isSubmitting ? 'Enviando...' : 'QUERO MINHA GESTÃO EBD GRATUITA!'}
                  </Button>
                  <p className="text-center text-sm text-gray-500">
                    Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-center">
        <div className="container mx-auto px-4">
          <img src={logoGestaoEBD} alt="Gestão EBD" className="h-8 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Gestão EBD. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingEBD;
