-- Criar tabela de módulos do GRUPO REOBOTE
CREATE TABLE IF NOT EXISTS public.modulos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_modulo text NOT NULL UNIQUE,
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir os módulos do REOBOTE
INSERT INTO public.modulos (nome_modulo, descricao) VALUES
  ('REOBOTE IGREJAS', 'Gestão completa para igrejas'),
  ('REOBOTE ASSOCIAÇÕES', 'Gestão para associações'),
  ('REOBOTE EBD', 'Escola Bíblica Dominical'),
  ('REOBOTE EVANGELISMO', 'Gestão de evangelismo'),
  ('REOBOTE BUSINESS', 'Gestão empresarial');

-- Criar tabela de assinaturas (relacionamento cliente-módulo)
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Pendente', 'Inativo')),
  data_ativacao timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, modulo_id)
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para módulos (todos podem visualizar)
CREATE POLICY "Todos podem visualizar módulos"
  ON public.modulos
  FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar módulos"
  ON public.modulos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para assinaturas
CREATE POLICY "Admins podem gerenciar todas assinaturas"
  ON public.assinaturas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clientes podem ver suas próprias assinaturas"
  ON public.assinaturas
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT id FROM churches WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_modulos_updated_at
  BEFORE UPDATE ON public.modulos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();