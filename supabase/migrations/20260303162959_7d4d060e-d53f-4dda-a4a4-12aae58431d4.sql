
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'MARKETING',
  idioma text NOT NULL DEFAULT 'pt_BR',
  corpo text NOT NULL,
  cabecalho_tipo text,
  cabecalho_texto text,
  rodape text,
  botoes jsonb DEFAULT '[]',
  variaveis_usadas text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'RASCUNHO',
  meta_template_id text,
  meta_rejection_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
ON public.whatsapp_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create templates"
ON public.whatsapp_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update templates"
ON public.whatsapp_templates FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete templates"
ON public.whatsapp_templates FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
