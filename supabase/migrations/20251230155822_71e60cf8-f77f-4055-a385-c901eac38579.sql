-- Tabela para registrar leituras confirmadas do Desafio Bíblico
CREATE TABLE public.ebd_desafio_leitura_registro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('aluno', 'professor')),
  conteudo_id UUID NOT NULL REFERENCES public.ebd_desafio_biblico_conteudo(id) ON DELETE CASCADE,
  dia_numero INTEGER NOT NULL CHECK (dia_numero >= 1 AND dia_numero <= 6),
  data_agendada DATE NOT NULL,
  data_leitura DATE NOT NULL DEFAULT CURRENT_DATE,
  pontos_ganhos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para buscar leituras por usuário
CREATE INDEX idx_desafio_leitura_user ON public.ebd_desafio_leitura_registro(user_id, user_type);
CREATE INDEX idx_desafio_leitura_church ON public.ebd_desafio_leitura_registro(church_id);
CREATE INDEX idx_desafio_leitura_conteudo ON public.ebd_desafio_leitura_registro(conteudo_id);

-- Unique constraint para evitar duplicatas
CREATE UNIQUE INDEX idx_desafio_leitura_unique ON public.ebd_desafio_leitura_registro(user_id, conteudo_id, dia_numero);

-- Enable RLS
ALTER TABLE public.ebd_desafio_leitura_registro ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all leitura_registro"
ON public.ebd_desafio_leitura_registro
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own leitura"
ON public.ebd_desafio_leitura_registro
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own leitura"
ON public.ebd_desafio_leitura_registro
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Church owners can view leitura of their church"
ON public.ebd_desafio_leitura_registro
FOR SELECT
USING (church_id IN (
  SELECT id FROM churches WHERE user_id = auth.uid()
));

CREATE POLICY "Superintendentes can view leitura of their church"
ON public.ebd_desafio_leitura_registro
FOR SELECT
USING (church_id IN (
  SELECT id FROM ebd_clientes WHERE superintendente_user_id = auth.uid() AND status_ativacao_ebd = true
));

-- Trigger para adicionar pontos ao aluno quando registrar leitura
CREATE OR REPLACE FUNCTION public.handle_desafio_leitura_pontos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Adicionar pontos apenas se for aluno
  IF NEW.user_type = 'aluno' AND NEW.pontos_ganhos > 0 THEN
    UPDATE public.ebd_alunos
    SET pontos_totais = pontos_totais + NEW.pontos_ganhos,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_desafio_leitura_pontos
AFTER INSERT ON public.ebd_desafio_leitura_registro
FOR EACH ROW
EXECUTE FUNCTION public.handle_desafio_leitura_pontos();