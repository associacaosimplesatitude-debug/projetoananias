
-- Create enums for Desafio Bíblico
CREATE TYPE public.desafio_tipo_publico AS ENUM ('PROFESSORES', 'ALUNOS');
CREATE TYPE public.desafio_status AS ENUM ('CONFIGURANDO', 'PRONTO', 'EM_ANDAMENTO', 'FINALIZADO');
CREATE TYPE public.desafio_equipe_nome AS ENUM ('EQUIPE_A', 'EQUIPE_B');
CREATE TYPE public.desafio_pergunta_tipo AS ENUM ('DESBLOQUEIO', 'CHARADA');

-- Table: desafio_biblico
CREATE TABLE public.desafio_biblico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_publico desafio_tipo_publico NOT NULL DEFAULT 'PROFESSORES',
  tempo_limite_minutos INTEGER NOT NULL DEFAULT 30,
  num_perguntas_desbloqueio INTEGER NOT NULL DEFAULT 5,
  num_blocos_charada INTEGER NOT NULL DEFAULT 3,
  status desafio_status NOT NULL DEFAULT 'CONFIGURANDO',
  iniciado_em TIMESTAMP WITH TIME ZONE,
  finalizado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: desafio_equipe
CREATE TABLE public.desafio_equipe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  desafio_id UUID NOT NULL REFERENCES public.desafio_biblico(id) ON DELETE CASCADE,
  nome desafio_equipe_nome NOT NULL,
  lider_id UUID REFERENCES public.ebd_professores(id),
  pontuacao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(desafio_id, nome)
);

-- Table: desafio_membro_equipe
CREATE TABLE public.desafio_membro_equipe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES public.desafio_equipe(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES public.ebd_professores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(equipe_id, professor_id)
);

-- Table: desafio_pergunta
CREATE TABLE public.desafio_pergunta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  desafio_id UUID NOT NULL REFERENCES public.desafio_biblico(id) ON DELETE CASCADE,
  tipo desafio_pergunta_tipo NOT NULL,
  texto_pergunta TEXT NOT NULL,
  resposta_correta TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  equipe_alvo desafio_equipe_nome NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: desafio_tentativa_resposta
CREATE TABLE public.desafio_tentativa_resposta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  desafio_id UUID NOT NULL REFERENCES public.desafio_biblico(id) ON DELETE CASCADE,
  pergunta_id UUID NOT NULL REFERENCES public.desafio_pergunta(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.desafio_equipe(id) ON DELETE CASCADE,
  resposta_enviada TEXT NOT NULL,
  acertou BOOLEAN NOT NULL DEFAULT false,
  respondido_por UUID REFERENCES public.ebd_professores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.desafio_biblico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafio_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafio_membro_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafio_pergunta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafio_tentativa_resposta ENABLE ROW LEVEL SECURITY;

-- RLS Policies for desafio_biblico
CREATE POLICY "Admins can manage all desafios" ON public.desafio_biblico
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their desafios" ON public.desafio_biblico
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

CREATE POLICY "Professors can view desafios from their church" ON public.desafio_biblico
  FOR SELECT USING (church_id IN (
    SELECT church_id FROM ebd_professores WHERE user_id = auth.uid() AND is_active = true
  ));

-- RLS Policies for desafio_equipe
CREATE POLICY "Admins can manage all equipes" ON public.desafio_equipe
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their equipes" ON public.desafio_equipe
  FOR ALL USING (desafio_id IN (
    SELECT id FROM desafio_biblico WHERE church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ))
  WITH CHECK (desafio_id IN (
    SELECT id FROM desafio_biblico WHERE church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ));

CREATE POLICY "Professors can view equipes" ON public.desafio_equipe
  FOR SELECT USING (desafio_id IN (
    SELECT id FROM desafio_biblico WHERE church_id IN (
      SELECT church_id FROM ebd_professores WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- RLS Policies for desafio_membro_equipe
CREATE POLICY "Admins can manage all membros" ON public.desafio_membro_equipe
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage membros" ON public.desafio_membro_equipe
  FOR ALL USING (equipe_id IN (
    SELECT de.id FROM desafio_equipe de
    JOIN desafio_biblico db ON de.desafio_id = db.id
    WHERE db.church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ))
  WITH CHECK (equipe_id IN (
    SELECT de.id FROM desafio_equipe de
    JOIN desafio_biblico db ON de.desafio_id = db.id
    WHERE db.church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ));

CREATE POLICY "Professors can view membros" ON public.desafio_membro_equipe
  FOR SELECT USING (equipe_id IN (
    SELECT de.id FROM desafio_equipe de
    JOIN desafio_biblico db ON de.desafio_id = db.id
    WHERE db.church_id IN (
      SELECT church_id FROM ebd_professores WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- RLS Policies for desafio_pergunta
CREATE POLICY "Admins can manage all perguntas" ON public.desafio_pergunta
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage perguntas" ON public.desafio_pergunta
  FOR ALL USING (desafio_id IN (
    SELECT id FROM desafio_biblico WHERE church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ))
  WITH CHECK (desafio_id IN (
    SELECT id FROM desafio_biblico WHERE church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ));

CREATE POLICY "Lideres can view their team perguntas during challenge" ON public.desafio_pergunta
  FOR SELECT USING (
    desafio_id IN (
      SELECT db.id FROM desafio_biblico db
      JOIN desafio_equipe de ON de.desafio_id = db.id
      WHERE db.status = 'EM_ANDAMENTO'
      AND de.lider_id IN (SELECT id FROM ebd_professores WHERE user_id = auth.uid())
      AND de.nome = equipe_alvo
    )
  );

-- RLS Policies for desafio_tentativa_resposta
CREATE POLICY "Admins can manage all tentativas" ON public.desafio_tentativa_resposta
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can view tentativas" ON public.desafio_tentativa_resposta
  FOR SELECT USING (desafio_id IN (
    SELECT id FROM desafio_biblico WHERE church_id IN (SELECT id FROM churches WHERE user_id = auth.uid())
  ));

CREATE POLICY "Lideres can insert tentativas for their team" ON public.desafio_tentativa_resposta
  FOR INSERT WITH CHECK (
    equipe_id IN (
      SELECT de.id FROM desafio_equipe de
      JOIN desafio_biblico db ON de.desafio_id = db.id
      WHERE db.status = 'EM_ANDAMENTO'
      AND de.lider_id IN (SELECT id FROM ebd_professores WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Lideres can view their team tentativas" ON public.desafio_tentativa_resposta
  FOR SELECT USING (
    equipe_id IN (
      SELECT de.id FROM desafio_equipe de
      WHERE de.lider_id IN (SELECT id FROM ebd_professores WHERE user_id = auth.uid())
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_desafio_biblico_updated_at
  BEFORE UPDATE ON public.desafio_biblico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_desafio_equipe_updated_at
  BEFORE UPDATE ON public.desafio_equipe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_desafio_pergunta_updated_at
  BEFORE UPDATE ON public.desafio_pergunta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_desafio_biblico_church_id ON public.desafio_biblico(church_id);
CREATE INDEX idx_desafio_biblico_status ON public.desafio_biblico(status);
CREATE INDEX idx_desafio_equipe_desafio_id ON public.desafio_equipe(desafio_id);
CREATE INDEX idx_desafio_pergunta_desafio_id ON public.desafio_pergunta(desafio_id);
CREATE INDEX idx_desafio_tentativa_desafio_id ON public.desafio_tentativa_resposta(desafio_id);
