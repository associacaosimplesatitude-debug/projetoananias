-- Tabela de links de afiliado
CREATE TABLE public.royalties_affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id UUID NOT NULL REFERENCES public.royalties_livros(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.royalties_autores(id) ON DELETE CASCADE,
  codigo_afiliado TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  link_externo TEXT NOT NULL,
  video_url TEXT,
  descricao_lp TEXT,
  comissao_percentual DECIMAL(5,2) NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de cliques
CREATE TABLE public.royalties_affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID NOT NULL REFERENCES public.royalties_affiliate_links(id) ON DELETE CASCADE,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de vendas de afiliado
CREATE TABLE public.royalties_affiliate_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID NOT NULL REFERENCES public.royalties_affiliate_links(id) ON DELETE CASCADE,
  shopify_order_id TEXT,
  shopify_order_number TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_venda DECIMAL(10,2) NOT NULL,
  valor_comissao DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices para performance
CREATE INDEX idx_affiliate_links_codigo ON public.royalties_affiliate_links(codigo_afiliado);
CREATE INDEX idx_affiliate_links_slug ON public.royalties_affiliate_links(slug);
CREATE INDEX idx_affiliate_links_livro ON public.royalties_affiliate_links(livro_id);
CREATE INDEX idx_affiliate_links_autor ON public.royalties_affiliate_links(autor_id);
CREATE INDEX idx_affiliate_clicks_link ON public.royalties_affiliate_clicks(affiliate_link_id);
CREATE INDEX idx_affiliate_clicks_date ON public.royalties_affiliate_clicks(clicked_at);
CREATE INDEX idx_affiliate_sales_link ON public.royalties_affiliate_sales(affiliate_link_id);
CREATE INDEX idx_affiliate_sales_status ON public.royalties_affiliate_sales(status);

-- Habilitar RLS
ALTER TABLE public.royalties_affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_affiliate_sales ENABLE ROW LEVEL SECURITY;

-- Policies para royalties_affiliate_links
CREATE POLICY "Admin full access affiliate_links" ON public.royalties_affiliate_links
  FOR ALL USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor read own affiliate_links" ON public.royalties_affiliate_links
  FOR SELECT USING (autor_id = public.get_autor_id_by_user(auth.uid()));

CREATE POLICY "Public read active affiliate_links" ON public.royalties_affiliate_links
  FOR SELECT USING (is_active = true);

-- Policies para royalties_affiliate_clicks
CREATE POLICY "Allow insert clicks anon" ON public.royalties_affiliate_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read all clicks" ON public.royalties_affiliate_clicks
  FOR SELECT USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor read own clicks" ON public.royalties_affiliate_clicks
  FOR SELECT USING (
    affiliate_link_id IN (
      SELECT id FROM public.royalties_affiliate_links 
      WHERE autor_id = public.get_autor_id_by_user(auth.uid())
    )
  );

-- Policies para royalties_affiliate_sales
CREATE POLICY "Admin full access affiliate_sales" ON public.royalties_affiliate_sales
  FOR ALL USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor read own affiliate_sales" ON public.royalties_affiliate_sales
  FOR SELECT USING (
    affiliate_link_id IN (
      SELECT id FROM public.royalties_affiliate_links 
      WHERE autor_id = public.get_autor_id_by_user(auth.uid())
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_affiliate_links_updated_at
  BEFORE UPDATE ON public.royalties_affiliate_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir primeiro link de afiliado (O Cativeiro Babilonico)
INSERT INTO public.royalties_affiliate_links (
  livro_id, 
  autor_id, 
  codigo_afiliado, 
  slug, 
  link_externo, 
  video_url, 
  comissao_percentual
) VALUES (
  'b8563451-31ea-4335-ac5c-6c3605ed81a8',
  'b7afbdf2-a0fb-4c4c-b85c-b31f439c24b5',
  'cativeiro-ronald',
  'cativeiro-babilonico',
  'https://www.centralgospel.com.br/products/o-cativeiro-babilonico-setenta-anos-de-exilio-fe-e-esperanca-pr-ronald-gustavo',
  'https://www.youtube.com/watch?v=KZbEnjKAsnA',
  30
);