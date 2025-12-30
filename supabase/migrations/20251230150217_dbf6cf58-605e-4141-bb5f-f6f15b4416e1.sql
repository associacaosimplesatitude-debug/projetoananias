-- Create table for Biblical Challenge content per lesson
CREATE TABLE public.ebd_desafio_biblico_conteudo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revista_id UUID NOT NULL REFERENCES public.ebd_revistas(id) ON DELETE CASCADE,
  licao_numero INTEGER NOT NULL,
  texto_aureo TEXT,
  dia1_livro TEXT NOT NULL,
  dia1_versiculo TEXT NOT NULL,
  dia2_livro TEXT NOT NULL,
  dia2_versiculo TEXT NOT NULL,
  dia3_livro TEXT NOT NULL,
  dia3_versiculo TEXT NOT NULL,
  dia4_livro TEXT NOT NULL,
  dia4_versiculo TEXT NOT NULL,
  dia5_livro TEXT NOT NULL,
  dia5_versiculo TEXT NOT NULL,
  dia6_livro TEXT NOT NULL,
  dia6_versiculo TEXT NOT NULL,
  pergunta TEXT NOT NULL,
  resposta_correta TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(revista_id, licao_numero)
);

-- Enable RLS
ALTER TABLE public.ebd_desafio_biblico_conteudo ENABLE ROW LEVEL SECURITY;

-- Admins can manage all content
CREATE POLICY "Admins can manage all desafio_biblico_conteudo" 
ON public.ebd_desafio_biblico_conteudo 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view content (needed for students/professors to see readings)
CREATE POLICY "Everyone can view desafio_biblico_conteudo" 
ON public.ebd_desafio_biblico_conteudo 
FOR SELECT 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_ebd_desafio_biblico_conteudo_updated_at
  BEFORE UPDATE ON public.ebd_desafio_biblico_conteudo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();