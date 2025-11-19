-- Criar tabela para armazenar dados da diretoria
CREATE TABLE IF NOT EXISTS public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  cargo text NOT NULL,
  nome_completo text NOT NULL,
  rg text NOT NULL,
  orgao_emissor text NOT NULL,
  cpf text NOT NULL,
  endereco text NOT NULL,
  cep text NOT NULL,
  estado_civil text NOT NULL,
  profissao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all board members"
  ON public.board_members
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Church owners can view their board members"
  ON public.board_members
  FOR SELECT
  USING (
    church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Church owners can insert their board members"
  ON public.board_members
  FOR INSERT
  WITH CHECK (
    church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  );

-- Índice para performance
CREATE INDEX idx_board_members_church_id ON public.board_members(church_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_board_members_updated_at
  BEFORE UPDATE ON public.board_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();