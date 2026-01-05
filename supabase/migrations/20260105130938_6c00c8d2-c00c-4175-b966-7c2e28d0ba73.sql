-- Tabela para armazenar descontos por categoria por cliente (para representantes)
CREATE TABLE public.ebd_descontos_categoria_representante (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentual_desconto >= 0 AND percentual_desconto <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, categoria)
);

-- Índice para busca rápida por cliente
CREATE INDEX idx_descontos_categoria_cliente ON public.ebd_descontos_categoria_representante(cliente_id);

-- Habilitar RLS
ALTER TABLE public.ebd_descontos_categoria_representante ENABLE ROW LEVEL SECURITY;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ebd_descontos_categoria_updated_at
BEFORE UPDATE ON public.ebd_descontos_categoria_representante
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS

-- Representantes podem ver descontos de seus clientes
CREATE POLICY "Representantes podem ver descontos de seus clientes"
ON public.ebd_descontos_categoria_representante
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ebd_clientes c
    JOIN public.vendedores v ON c.vendedor_id = v.id
    WHERE c.id = cliente_id
    AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND v.tipo_perfil = 'representante'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente_ebd')
);

-- Representantes podem inserir descontos para seus clientes
CREATE POLICY "Representantes podem inserir descontos para seus clientes"
ON public.ebd_descontos_categoria_representante
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ebd_clientes c
    JOIN public.vendedores v ON c.vendedor_id = v.id
    WHERE c.id = cliente_id
    AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND v.tipo_perfil = 'representante'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente_ebd')
);

-- Representantes podem atualizar descontos de seus clientes
CREATE POLICY "Representantes podem atualizar descontos de seus clientes"
ON public.ebd_descontos_categoria_representante
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ebd_clientes c
    JOIN public.vendedores v ON c.vendedor_id = v.id
    WHERE c.id = cliente_id
    AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND v.tipo_perfil = 'representante'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente_ebd')
);

-- Representantes podem deletar descontos de seus clientes
CREATE POLICY "Representantes podem deletar descontos de seus clientes"
ON public.ebd_descontos_categoria_representante
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ebd_clientes c
    JOIN public.vendedores v ON c.vendedor_id = v.id
    WHERE c.id = cliente_id
    AND v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND v.tipo_perfil = 'representante'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente_ebd')
);