
CREATE TABLE public.whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  cliente_id UUID REFERENCES public.ebd_clientes(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_whatsapp_conversas_telefone ON public.whatsapp_conversas(telefone);
CREATE INDEX idx_whatsapp_conversas_created ON public.whatsapp_conversas(created_at DESC);

ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_conversas"
ON public.whatsapp_conversas
FOR ALL
USING (true)
WITH CHECK (true);
