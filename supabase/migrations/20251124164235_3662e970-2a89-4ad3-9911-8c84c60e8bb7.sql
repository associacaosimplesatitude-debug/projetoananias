-- Criar tabela de turmas/salas da EBD
CREATE TABLE public.ebd_turmas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  faixa_etaria TEXT NOT NULL,
  descricao TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de professores da EBD
CREATE TABLE public.ebd_professores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  turma_id UUID REFERENCES public.ebd_turmas(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de alunos da EBD
CREATE TABLE public.ebd_alunos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES public.ebd_turmas(id) ON DELETE SET NULL,
  nome_completo TEXT NOT NULL,
  data_nascimento DATE,
  email TEXT,
  telefone TEXT,
  responsavel TEXT,
  pontos_totais INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de frequência
CREATE TABLE public.ebd_frequencia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  presente BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, data)
);

-- Criar tabela de lições
CREATE TABLE public.ebd_licoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  data_aula DATE NOT NULL,
  arquivo_url TEXT,
  publicada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de acesso às lições
CREATE TABLE public.ebd_licoes_acesso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licao_id UUID NOT NULL REFERENCES public.ebd_licoes(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  acessado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(licao_id, aluno_id)
);

-- Criar tabela de quizzes
CREATE TABLE public.ebd_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  licao_id UUID REFERENCES public.ebd_licoes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  pontos_max INTEGER NOT NULL DEFAULT 10,
  data_limite DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de questões dos quizzes
CREATE TABLE public.ebd_quiz_questoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.ebd_quizzes(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  pergunta TEXT NOT NULL,
  opcao_a TEXT NOT NULL,
  opcao_b TEXT NOT NULL,
  opcao_c TEXT,
  opcao_d TEXT,
  resposta_correta CHAR(1) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de respostas dos alunos
CREATE TABLE public.ebd_quiz_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.ebd_quizzes(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  pontos_obtidos INTEGER NOT NULL DEFAULT 0,
  completado BOOLEAN NOT NULL DEFAULT false,
  completado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, aluno_id)
);

-- Criar tabela de badges/conquistas
CREATE TABLE public.ebd_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  criterio TEXT NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de badges conquistadas
CREATE TABLE public.ebd_aluno_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.ebd_badges(id) ON DELETE CASCADE,
  conquistado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, badge_id)
);

-- Criar tabela de devocionais
CREATE TABLE public.ebd_devocionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de registro de devocionais feitos
CREATE TABLE public.ebd_devocional_registro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devocional_id UUID NOT NULL REFERENCES public.ebd_devocionais(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  feito_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(devocional_id, aluno_id)
);

-- Criar tabela de escala
CREATE TABLE public.ebd_escalas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES public.ebd_professores(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo TEXT NOT NULL, -- 'titular', 'substituto', 'auxiliar'
  observacao TEXT,
  confirmado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.ebd_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_frequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_licoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_licoes_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_quiz_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_quiz_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_aluno_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_devocionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_devocional_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_escalas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para turmas
CREATE POLICY "Admins can manage all turmas" ON public.ebd_turmas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their turmas" ON public.ebd_turmas
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para professores
CREATE POLICY "Admins can manage all professores" ON public.ebd_professores
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their professores" ON public.ebd_professores
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para alunos
CREATE POLICY "Admins can manage all alunos" ON public.ebd_alunos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their alunos" ON public.ebd_alunos
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para frequência
CREATE POLICY "Admins can manage all frequencia" ON public.ebd_frequencia
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their frequencia" ON public.ebd_frequencia
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para lições
CREATE POLICY "Admins can manage all licoes" ON public.ebd_licoes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their licoes" ON public.ebd_licoes
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para acesso às lições
CREATE POLICY "Admins can manage all licoes_acesso" ON public.ebd_licoes_acesso
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para quizzes
CREATE POLICY "Admins can manage all quizzes" ON public.ebd_quizzes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their quizzes" ON public.ebd_quizzes
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para questões
CREATE POLICY "Admins can manage all questoes" ON public.ebd_quiz_questoes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para respostas
CREATE POLICY "Admins can manage all respostas" ON public.ebd_quiz_respostas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para badges
CREATE POLICY "Admins can manage all badges" ON public.ebd_badges
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their badges" ON public.ebd_badges
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para badges conquistadas
CREATE POLICY "Admins can manage all aluno_badges" ON public.ebd_aluno_badges
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para devocionais
CREATE POLICY "Admins can manage all devocionais" ON public.ebd_devocionais
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their devocionais" ON public.ebd_devocionais
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Políticas RLS para registro de devocionais
CREATE POLICY "Admins can manage all devocional_registro" ON public.ebd_devocional_registro
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para escalas
CREATE POLICY "Admins can manage all escalas" ON public.ebd_escalas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their escalas" ON public.ebd_escalas
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Criar triggers para atualizar updated_at
CREATE TRIGGER update_ebd_turmas_updated_at BEFORE UPDATE ON public.ebd_turmas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_professores_updated_at BEFORE UPDATE ON public.ebd_professores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_alunos_updated_at BEFORE UPDATE ON public.ebd_alunos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_frequencia_updated_at BEFORE UPDATE ON public.ebd_frequencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_licoes_updated_at BEFORE UPDATE ON public.ebd_licoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_quiz_respostas_updated_at BEFORE UPDATE ON public.ebd_quiz_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_escalas_updated_at BEFORE UPDATE ON public.ebd_escalas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();