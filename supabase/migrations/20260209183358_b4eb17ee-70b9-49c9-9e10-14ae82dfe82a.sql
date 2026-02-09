
-- Add columns to whatsapp_mensagens
ALTER TABLE public.whatsapp_mensagens
ADD COLUMN payload_enviado jsonb,
ADD COLUMN resposta_recebida jsonb;

-- Create whatsapp_webhooks table
CREATE TABLE public.whatsapp_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  telefone TEXT,
  message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_webhooks ENABLE ROW LEVEL SECURITY;

-- Only admins/gerente_ebd can read webhooks
CREATE POLICY "Admins can view webhooks"
ON public.whatsapp_webhooks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);
