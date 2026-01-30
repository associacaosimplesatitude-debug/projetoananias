
# Plano: Landing Page de Livro com Sistema de Afiliados

## Visao Geral

Criar landing pages individuais para cada livro focadas em vendas, com sistema de tracking de cliques e comissao adicional de 30% para o autor por vendas originadas do link.

---

## Estrutura do Sistema

```text
+--------------------------------------------------+
|  FLUXO DO SISTEMA DE AFILIADOS                   |
+--------------------------------------------------+
|                                                  |
|  1. Autor compartilha link:                      |
|     livro.centralgospel.com/abc123               |
|                                                  |
|  2. Visitante acessa Landing Page                |
|     -> Sistema registra CLICK                    |
|     -> Pagina exibe livro + video + CTA          |
|                                                  |
|  3. Visitante clica "Comprar Agora"              |
|     -> Redireciona para Shopify com UTM          |
|     -> URL: centralgospel.com.br/products/...    |
|              ?utm_source=autor&utm_campaign=xxx  |
|                                                  |
|  4. Shopify Webhook (compra concluida)           |
|     -> Edge Function recebe pedido               |
|     -> Verifica UTM/cookie de afiliado           |
|     -> Registra venda com comissao 30%           |
|                                                  |
|  5. Paineis atualizados automaticamente          |
|     -> Admin: ve todas as vendas afiliadas       |
|     -> Autor: ve suas vendas + comissoes         |
+--------------------------------------------------+
```

---

## Novas Tabelas no Banco de Dados

### 1. royalties_affiliate_links
Armazena links unicos de afiliado para cada livro/autor.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| livro_id | uuid | FK -> royalties_livros |
| autor_id | uuid | FK -> royalties_autores |
| codigo_afiliado | text | Codigo unico (ex: "abc123") |
| link_externo | text | URL do produto na Shopify |
| video_url | text | URL do video promocional |
| comissao_percentual | decimal | Percentual (default 30%) |
| is_active | boolean | Se o link esta ativo |
| created_at | timestamp | |

### 2. royalties_affiliate_clicks
Registra todos os cliques nos links de afiliado.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| affiliate_link_id | uuid | FK -> royalties_affiliate_links |
| ip_address | text | IP do visitante (anonimizado) |
| user_agent | text | Browser/dispositivo |
| referrer | text | De onde veio o clique |
| clicked_at | timestamp | Momento do clique |

### 3. royalties_affiliate_sales
Registra vendas originadas dos links de afiliado.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| affiliate_link_id | uuid | FK -> royalties_affiliate_links |
| shopify_order_id | text | ID do pedido no Shopify |
| shopify_order_number | text | Numero do pedido |
| quantidade | integer | Unidades vendidas |
| valor_venda | decimal | Valor total da venda |
| valor_comissao | decimal | 30% do valor |
| status | text | pendente/confirmado/pago |
| created_at | timestamp | |

---

## Paginas e Componentes

### 1. Landing Page Publica
**Rota:** `/livro/:codigo` (ex: `/livro/cativeiro-babilonico`)

Layout focado em conversao:

```text
+--------------------------------------------------+
|  [Logo Central Gospel]              [Comprar]    |
+--------------------------------------------------+
|                                                  |
|  +----------------+  +------------------------+  |
|  |                |  |                        |  |
|  |   CAPA DO      |  |  TITULO DO LIVRO       |  |
|  |   LIVRO        |  |  Por: Nome do Autor    |  |
|  |                |  |                        |  |
|  |                |  |  R$ 22,45              |  |
|  |                |  |                        |  |
|  +----------------+  |  [COMPRAR AGORA] ----→ |  |
|                      +------------------------+  |
|                                                  |
+--------------------------------------------------+
|                VIDEO DO AUTOR                    |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |     [▶]  YouTube Embed                     |  |
|  |         KZbEnjKAsnA                        |  |
|  |                                            |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
|                                                  |
|  SOBRE O LIVRO                                   |
|  Descricao detalhada do livro...                 |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  SOBRE O AUTOR                                   |
|  +--------+  Nome: Ronald Gustavo               |
|  | FOTO   |  Bio breve do autor...              |
|  +--------+                                      |
|                                                  |
+--------------------------------------------------+
|           [COMPRAR AGORA] ----→                  |
+--------------------------------------------------+
```

### 2. Painel Admin - Vendas por Afiliado
**Rota:** `/royalties/afiliados`

Nova pagina no menu de Royalties:
- Lista todos os links de afiliado ativos
- Metricas: cliques, vendas, taxa de conversao
- Filtros por livro, autor, periodo
- Exportacao CSV

### 3. Painel do Autor - Minhas Vendas por Link
**Rota:** `/autor/afiliados`

Nova aba no painel do autor:
- Ver link pessoal para cada livro
- Copiar link com um clique
- Historico de cliques e vendas
- Total de comissoes de afiliado (30%)

---

## Edge Functions

### 1. track-affiliate-click
Registra o clique quando alguem acessa a landing page.

```typescript
// POST /track-affiliate-click
{
  codigo_afiliado: "abc123",
  referrer: "https://instagram.com/...",
  user_agent: "Mozilla/5.0..."
}
```

### 2. register-affiliate-sale (Webhook Shopify)
Processa vendas que vieram de links de afiliado.

Logica:
1. Recebe webhook de pedido confirmado do Shopify
2. Verifica se tem UTM `utm_source=autor` e `utm_campaign=CODIGO`
3. Busca o affiliate_link correspondente
4. Calcula comissao de 30%
5. Insere em `royalties_affiliate_sales`
6. O autor continua ganhando royalties normais (5%) via sync existente

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/public/LivroLandingPage.tsx` | Landing page publica |
| `src/pages/royalties/Afiliados.tsx` | Painel admin de afiliados |
| `src/pages/autor/MeusAfiliados.tsx` | Painel autor afiliados |
| `src/components/royalties/AffiliateLinkManager.tsx` | Gerenciar links |
| `supabase/functions/track-affiliate-click/index.ts` | Tracking cliques |
| `supabase/functions/register-affiliate-sale/index.ts` | Webhook vendas |
| Migration SQL | Criar tabelas de afiliados |

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/App.tsx` | Adicionar rota publica `/livro/:codigo` |
| `src/components/royalties/RoyaltiesAdminLayout.tsx` | Menu "Afiliados" |
| `src/components/royalties/AutorLayout.tsx` | Menu "Meus Links" |
| `src/pages/royalties/Livros.tsx` | Botao "Gerar Link" por livro |

---

## Migration SQL

```sql
-- Tabela de links de afiliado
CREATE TABLE public.royalties_affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id UUID NOT NULL REFERENCES public.royalties_livros(id),
  autor_id UUID NOT NULL REFERENCES public.royalties_autores(id),
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
  affiliate_link_id UUID NOT NULL REFERENCES public.royalties_affiliate_links(id),
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de vendas de afiliado
CREATE TABLE public.royalties_affiliate_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID NOT NULL REFERENCES public.royalties_affiliate_links(id),
  shopify_order_id TEXT,
  shopify_order_number TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_venda DECIMAL(10,2) NOT NULL,
  valor_comissao DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_affiliate_links_codigo ON public.royalties_affiliate_links(codigo_afiliado);
CREATE INDEX idx_affiliate_links_slug ON public.royalties_affiliate_links(slug);
CREATE INDEX idx_affiliate_clicks_link ON public.royalties_affiliate_clicks(affiliate_link_id);
CREATE INDEX idx_affiliate_sales_link ON public.royalties_affiliate_sales(affiliate_link_id);

-- RLS
ALTER TABLE public.royalties_affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_affiliate_sales ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin full access affiliate_links" ON public.royalties_affiliate_links
  FOR ALL USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor read own affiliate_links" ON public.royalties_affiliate_links
  FOR SELECT USING (autor_id = public.get_autor_id_by_user(auth.uid()));

CREATE POLICY "Public read active affiliate_links" ON public.royalties_affiliate_links
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow insert clicks" ON public.royalties_affiliate_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read all clicks" ON public.royalties_affiliate_clicks
  FOR SELECT USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admin full access affiliate_sales" ON public.royalties_affiliate_sales
  FOR ALL USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor read own affiliate_sales" ON public.royalties_affiliate_sales
  FOR SELECT USING (
    affiliate_link_id IN (
      SELECT id FROM public.royalties_affiliate_links 
      WHERE autor_id = public.get_autor_id_by_user(auth.uid())
    )
  );
```

---

## Fluxo Detalhado de Comissoes

O autor Ronald Gustavo ganha:
1. **Royalties normais (5%)**: De TODAS as vendas do livro (via Bling sync)
2. **Comissao afiliado (30%)**: Apenas das vendas originadas do SEU link

Exemplo:
- Livro: R$ 22,45
- Venda via link do autor:
  - Royalty normal: R$ 1,12 (5%)
  - Comissao afiliado: R$ 6,74 (30%)
  - **Total autor recebe: R$ 7,86**

---

## Primeiro Link a Criar

Dados iniciais para o livro "O Cativeiro Babilonico":

| Campo | Valor |
|-------|-------|
| livro_id | b8563451-31ea-4335-ac5c-6c3605ed81a8 |
| autor_id | b7afbdf2-a0fb-4c4c-b85c-b31f439c24b5 |
| codigo_afiliado | cativeiro-ronald |
| slug | cativeiro-babilonico |
| link_externo | https://www.centralgospel.com.br/products/o-cativeiro-babilonico-setenta-anos-de-exilio-fe-e-esperanca-pr-ronald-gustavo |
| video_url | https://www.youtube.com/watch?v=KZbEnjKAsnA |
| comissao_percentual | 30 |

URL final: `gestaoebd.lovable.app/livro/cativeiro-babilonico`

---

## Proximos Passos

1. Aprovar este plano
2. Criar migration SQL para as 3 tabelas
3. Implementar Landing Page publica
4. Criar Edge Function de tracking de cliques
5. Implementar painel Admin de afiliados
6. Implementar painel Autor de afiliados
7. Configurar webhook Shopify para vendas
8. Testar fluxo completo
