

## Contador de acessos à página /sorteio

### O que será feito

1. **Criar tabela `sorteio_page_views`** no banco para registrar cada visita:
   - `id` (uuid, PK)
   - `sessao_id` (uuid, nullable, FK para sorteio_sessoes)
   - `ip_hash` (text, nullable - IP anonimizado)
   - `user_agent` (text, nullable)
   - `referrer` (text, nullable)
   - `created_at` (timestamptz, default now())
   - RLS: permitir INSERT para anon/authenticated (público), SELECT apenas para admins

2. **Registrar acesso no frontend** (`SorteioLanding.tsx`)
   - No `useEffect` inicial, fazer um insert na tabela `sorteio_page_views` com sessao_id ativa (se houver)
   - Fire-and-forget, sem bloquear o carregamento da página

3. **Exibir contador no painel admin** (`SorteioAdmin.tsx`)
   - Adicionar card com total de acessos (hoje e total geral) na aba Sessões, junto aos cards existentes
   - Query simples com count na tabela `sorteio_page_views`
   - Ícone `Eye` para visualização rápida

### Detalhes técnicos

**Migration SQL:**
```sql
CREATE TABLE public.sorteio_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid REFERENCES public.sorteio_sessoes(id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sorteio_page_views ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante pode registrar acesso
CREATE POLICY "Anyone can insert page views"
  ON public.sorteio_page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Apenas admins podem ver
CREATE POLICY "Admins can view page views"
  ON public.sorteio_page_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

**Frontend (SorteioLanding.tsx):** useEffect com insert assíncrono no mount.

**Admin (SorteioAdmin.tsx):** Card com contagem de acessos hoje + total, posicionado no topo da aba Sessões.

