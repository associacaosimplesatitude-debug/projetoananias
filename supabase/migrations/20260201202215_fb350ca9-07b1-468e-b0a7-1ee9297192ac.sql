-- Adicionar campo de desconto nos próprios livros
ALTER TABLE royalties_autores 
ADD COLUMN desconto_livros_proprios NUMERIC(5,2) DEFAULT 0;

-- Tabela de descontos por categoria para autores
CREATE TABLE royalties_descontos_categoria_autor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES royalties_autores(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL CHECK (percentual_desconto >= 0 AND percentual_desconto <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(autor_id, categoria)
);

-- Tabela de resgates
CREATE TABLE royalties_resgates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES royalties_autores(id),
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'enviado', 'cancelado')),
  valor_total NUMERIC(10,2) NOT NULL,
  itens JSONB NOT NULL,
  endereco_entrega JSONB,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE royalties_descontos_categoria_autor ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalties_resgates ENABLE ROW LEVEL SECURITY;

-- Políticas para descontos por categoria
CREATE POLICY "Admin full access descontos autor" 
ON royalties_descontos_categoria_autor FOR ALL 
TO authenticated USING (public.has_royalties_access(auth.uid()));

-- Políticas para resgates - Admin
CREATE POLICY "Admin full access resgates" 
ON royalties_resgates FOR ALL 
TO authenticated USING (public.has_royalties_access(auth.uid()));

-- Políticas para resgates - Autor (visualizar próprios)
CREATE POLICY "Autor view own resgates" 
ON royalties_resgates FOR SELECT 
TO authenticated USING (
  autor_id = public.get_autor_id_by_user(auth.uid())
);

-- Políticas para resgates - Autor (criar próprios)
CREATE POLICY "Autor insert own resgates" 
ON royalties_resgates FOR INSERT 
TO authenticated WITH CHECK (
  autor_id = public.get_autor_id_by_user(auth.uid())
);

-- Triggers para updated_at
CREATE TRIGGER update_royalties_descontos_categoria_autor_updated_at
  BEFORE UPDATE ON royalties_descontos_categoria_autor
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalties_resgates_updated_at
  BEFORE UPDATE ON royalties_resgates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger de auditoria para resgates
CREATE TRIGGER royalties_resgates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON royalties_resgates
  FOR EACH ROW
  EXECUTE FUNCTION royalties_audit_trigger_fn();