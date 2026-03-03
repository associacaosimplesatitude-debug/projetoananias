import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2,
  Gift,
  Percent,
  ArrowRight,
  BookOpen,
  Users,
  Trophy,
  BarChart3,
  ClipboardList,
  MessageCircle,
  GraduationCap,
  Zap,
} from 'lucide-react';

import logoGestaoEBD from '@/assets/landing/logo-gestao-ebd.png';
import dashboardNotebook from '@/assets/landing/dashboard-notebook.png';
import rankingAlunos from '@/assets/landing/ranking-alunos.png';
import listaProfessores from '@/assets/landing/lista-professores.png';
import catalogoMateriais from '@/assets/landing/catalogo-materiais.png';

import revista1 from '@/assets/ofertas/revista-1.png';
import revista2 from '@/assets/ofertas/revista-2.webp';
import revista3 from '@/assets/ofertas/revista-3.webp';
import revista4 from '@/assets/ofertas/revista-4.webp';

const OfertaEBD = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nomeIgreja: '',
    nomeResponsavel: '',
    email: '',
    telefone: '',
    senha: '',
    comoConheceu: '',
  });

  const opcoesComoConheceu = [
    'WhatsApp',
    'Google',
    'YouTube',
    'Instagram',
    'Facebook',
    'Indicação',
    'Outros',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nomeIgreja || !formData.nomeResponsavel || !formData.email || !formData.telefone || !formData.senha || !formData.comoConheceu) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    if (formData.senha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('ebd-instant-signup', {
        body: {
          nomeIgreja: formData.nomeIgreja,
          nomeResponsavel: formData.nomeResponsavel,
          email: formData.email,
          telefone: formData.telefone,
          senha: formData.senha,
          comoConheceu: formData.comoConheceu,
          origemLead: 'Campanha WhatsApp Reativação',
          tipoLead: 'Reativação',
        },
      });

      if (error) throw error;

      if (data?.userAlreadyExists) {
        toast.info('Você já possui uma conta! Faça login para acessar o painel.');
        navigate('/login/ebd');
        return;
      }

      toast.success('Conta criada com sucesso! Faça login para acessar o painel.');
      setModalOpen(false);
      navigate('/login/ebd');
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);
      toast.error(error?.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const revistas = [
    { image: revista1, title: 'Revista EBD — Jovens e Adultos' },
    { image: revista2, title: 'Revista EBD — Cartas da Prisão' },
    { image: revista3, title: 'Revista EBD — Estudo Bíblico' },
    { image: revista4, title: 'Revista EBD — Epístolas' },
  ];

  const features = [
    {
      title: 'Painel do Superintendente',
      subtitle: 'Visão Estratégica Completa',
      description: 'Tenha todos os dados da sua EBD em um só lugar. KPIs em tempo real, gestão de turmas e relatórios detalhados.',
      image: dashboardNotebook,
      items: ['KPIs em Tempo Real (Alunos, Professores, Turmas, Frequência)', 'Gestão Completa de Turmas', 'Relatórios Detalhados e Exportáveis'],
    },
    {
      title: 'Gestão de Professores',
      subtitle: 'Capacitação e Acompanhamento',
      description: 'Cada professor tem sua área exclusiva para lançar frequência, acessar materiais e se comunicar com a turma.',
      image: listaProfessores,
      items: ['Área Exclusiva para Cada Professor', 'Lançamento de Frequência Simplificado', 'Comunicação Direta com Turmas'],
    },
    {
      title: 'Ranking e Engajamento',
      subtitle: 'Gamificação que Motiva',
      description: 'Sistema de pontuação e ranking que incentiva a participação e o engajamento dos alunos.',
      image: rankingAlunos,
      items: ['Ficha de Aluno Digital Completa', 'Histórico de Frequência e Participação', 'Gamificação com Ranking de Pontos'],
    },
    {
      title: 'Catálogo de Materiais',
      subtitle: 'Tudo Organizado',
      description: 'Acesse e gerencie todos os materiais didáticos organizados por faixa etária.',
      image: catalogoMateriais,
      items: ['Acesso a Revistas EBD', 'Materiais Organizados por Faixa Etária', 'Integração com Catálogo de Ofertas'],
    },
  ];

  const beneficios = [
    { icon: BarChart3, text: 'Dashboard com KPIs em Tempo Real' },
    { icon: Users, text: 'Gestão de Turmas e Alunos' },
    { icon: ClipboardList, text: 'Controle de Frequência Digital' },
    { icon: GraduationCap, text: 'Área Exclusiva do Professor' },
    { icon: Trophy, text: 'Gamificação e Ranking de Alunos' },
    { icon: MessageCircle, text: 'Comunicação com Professores e Alunos' },
    { icon: BookOpen, text: 'Catálogo de Revistas com Desconto' },
    { icon: Zap, text: 'Relatórios Exportáveis (PDF/Excel)' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoGestaoEBD} alt="Gestão EBD" className="h-12 md:h-14" />
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold"
          >
            QUERO MEU DESCONTO
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmMxMDciIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-bold mb-6 animate-pulse">
                <Percent className="w-4 h-4" />
                OFERTA EXCLUSIVA PARA VOCÊ
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
                <span className="text-[#FFC107]">20% DE DESCONTO</span>
                <br />
                EM REVISTAS EBD
              </h1>
              <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-4 mb-8 backdrop-blur-sm">
                <Gift className="w-10 h-10 text-[#FFC107] flex-shrink-0" />
                <div>
                  <p className="text-[#FFC107] font-bold text-lg">+ PRESENTE EXCLUSIVO</p>
                  <p className="text-gray-300 text-sm">Acesso GRÁTIS ao Sistema Gestão EBD completo</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="lg"
                  onClick={() => setModalOpen(true)}
                  className="bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold text-lg px-8 py-6 shadow-lg shadow-[#FFC107]/30"
                >
                  QUERO MEU DESCONTO <ArrowRight className="ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setModalOpen(true)}
                  className="border-[#FFC107] text-[#FFC107] hover:bg-[#FFC107]/10 font-bold text-lg px-8 py-6"
                >
                  QUERO MEU ACESSO GRÁTIS
                </Button>
              </div>
            </div>
            <div className="relative hidden lg:block">
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

      {/* Revistas com Desconto */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-full text-lg font-bold mb-6">
              <Percent className="w-6 h-6" />
              20% DE DESCONTO
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-black mb-4">
              Revistas Selecionadas com <span className="text-red-500">Desconto Exclusivo</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              Renove o material de estudo bíblico da sua igreja com preço especial. Válido por tempo limitado!
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {revistas.map((revista, index) => (
              <div key={index} className="relative group">
                <div className="absolute -top-3 -right-3 z-10 bg-red-500 text-white text-sm font-black px-3 py-1 rounded-full shadow-lg">
                  20% OFF
                </div>
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-transparent group-hover:border-[#FFC107] transition-all duration-300 group-hover:shadow-xl">
                  <img
                    src={revista.image}
                    alt={revista.title}
                    className="w-full aspect-[3/4] object-cover"
                  />
                </div>
                <p className="text-center text-sm font-medium text-gray-700 mt-3">{revista.title}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button
              size="lg"
              onClick={() => setModalOpen(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-lg px-10 py-6 shadow-lg"
            >
              QUERO MEU DESCONTO DE 20% <ArrowRight className="ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Presente — Gestão EBD */}
      <section className="py-16 md:py-24 bg-[#FFC107]">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-black text-[#FFC107] px-6 py-3 rounded-full text-lg font-bold mb-6">
            <Gift className="w-6 h-6" />
            SEU PRESENTE EXCLUSIVO
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-black mb-4">
            Acesso GRÁTIS ao Sistema Gestão EBD
          </h2>
          <p className="text-black/80 max-w-2xl mx-auto text-lg mb-8">
            Além do desconto nas revistas, você ganha acesso completo à plataforma de gestão mais completa para Escolas Bíblicas Dominicais. 100% gratuito!
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {beneficios.map((b, i) => (
              <div key={i} className="bg-black/10 rounded-xl p-4 flex flex-col items-center gap-2">
                <b.icon className="w-8 h-8 text-black" />
                <span className="text-sm font-bold text-black text-center">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features detalhadas */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
              Conheça o que você ganha <span className="text-[#FFC107]">de presente</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Funcionalidades completas que vão transformar a gestão da sua EBD.
            </p>
          </div>
          <div className="space-y-20">
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

      {/* CTA Final */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-black via-gray-900 to-black text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Não perca essa <span className="text-[#FFC107]">oportunidade exclusiva!</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-10">
            20% de desconto em revistas + acesso grátis ao sistema de gestão. Oferta por tempo limitado para clientes selecionados.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => setModalOpen(true)}
              className="bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold text-lg px-10 py-6 shadow-lg shadow-[#FFC107]/30"
            >
              QUERO MEU DESCONTO <Percent className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="border-[#FFC107] text-[#FFC107] hover:bg-[#FFC107]/10 font-bold text-lg px-10 py-6"
            >
              QUERO MEU ACESSO GRÁTIS <Gift className="ml-2 w-5 h-5" />
            </Button>
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

      {/* Modal de Formulário */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              🎁 Garanta seu Desconto + Acesso Grátis
            </DialogTitle>
            <DialogDescription className="text-center">
              Preencha os dados abaixo para ativar seu desconto de 20% e receber acesso ao Gestão EBD.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Igreja *</label>
              <Input
                placeholder="Ex: Igreja Batista Central"
                value={formData.nomeIgreja}
                onChange={(e) => setFormData({ ...formData, nomeIgreja: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome *</label>
              <Input
                placeholder="Seu nome completo"
                value={formData.nomeResponsavel}
                onChange={(e) => setFormData({ ...formData, nomeResponsavel: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp *</label>
              <Input
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Como nos conheceu? *</label>
              <select
                value={formData.comoConheceu}
                onChange={(e) => setFormData({ ...formData, comoConheceu: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione uma opção</option>
                {opcoesComoConheceu.map((opcao) => (
                  <option key={opcao} value={opcao}>{opcao}</option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full bg-[#FFC107] hover:bg-[#FFB300] text-black font-bold text-lg h-14"
            >
              {isSubmitting ? 'Enviando...' : 'ATIVAR MEU DESCONTO + ACESSO GRÁTIS'}
            </Button>
            <p className="text-center text-xs text-gray-500">
              Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfertaEBD;
