
Objetivo: fazer a LP `/livro/cativeiro-babilonico` abrir em produção e preview, sem cair em “Livro não encontrado”.

## Diagnóstico (o que está acontecendo agora)
1) O registro do link existe e está ativo:
- `royalties_affiliate_links.slug = 'cativeiro-babilonico'` e `is_active = true` (confirmado)
- Livro e autor também existem e estão ativos (confirmado)

2) As permissões (RLS) para leitura pública de **livro** e **autor** já existem e estão corretas (confirmado).

3) O problema mais provável é a **query com JOIN embutido** no frontend:
```ts
livro:royalties_livros!livro_id (...)
autor:royalties_autores!autor_id (...)
```
Esse tipo de “embed” só funciona bem quando o banco tem **relacionamentos (Foreign Keys)** definidos.  
Ao checar as constraints da tabela `royalties_affiliate_links`, não apareceu nenhuma FK/PK (confirmado).  
Resultado típico: o backend de REST não consegue montar o relacionamento e retorna erro -> o catch do React seta “Livro não encontrado”.

Em outras palavras: os dados existem, mas o “JOIN automático” não consegue acontecer porque faltam constraints.

## Estratégia de correção (rápida e robusta)
Vamos fazer duas coisas, na ordem certa, para resolver “agora” e evitar voltar a quebrar:

### A) Corrigir o frontend para não depender de embed (resolução imediata)
Alterar `LivroLandingPage.tsx` para:
1. Buscar apenas o link em `royalties_affiliate_links` (sem embed), retornando `livro_id` e `autor_id`.
2. Em seguida, fazer 2 consultas simples:
   - `royalties_livros` por `id = livro_id`
   - `royalties_autores` por `id = autor_id`
3. Montar o objeto final no frontend e renderizar.

Benefícios:
- Funciona mesmo se o banco estiver sem FK (e mesmo se o REST não suportar embed).
- Fica mais previsível para debug.
- Evita “falso 404” por erro de relacionamento.

Melhoria extra (para evitar “apagão”):
- Em vez de sempre mostrar “Livro não encontrado” para qualquer erro, vamos logar e mostrar uma mensagem amigável, mas com um “código de erro” no console (ex.: `PGRST...`) para diagnóstico rápido.

### B) Corrigir o banco adicionando as Foreign Keys (resolução definitiva)
Criar uma migration com:
- PK em `royalties_affiliate_links.id` (se ainda não existir)
- FK `royalties_affiliate_links.livro_id -> royalties_livros.id`
- FK `royalties_affiliate_links.autor_id -> royalties_autores.id`
- (Opcional) índices em `slug`, `livro_id`, `autor_id` para performance

Antes de aplicar, vamos:
- validar se não há dados “órfãos” (links apontando para livro/autor inexistente). Pelo menos para este slug, está OK.

Benefícios:
- Permite voltar a usar embed no futuro (se quisermos).
- Garante integridade dos dados.
- Evita inconsistências quando forem criados mais links.

## Como vou testar (end-to-end)
1) Abrir a LP no **domínio publicado**: `https://gestaoebd.com.br/livro/cativeiro-babilonico`
2) Abrir a LP no **preview** (domínio de preview do projeto)
3) Verificar no Network:
- 1 request para buscar o link por slug
- 1 request para buscar o livro por id
- 1 request para buscar o autor por id
4) Confirmar render:
- título, preço, autor, botão “Comprar Agora”, vídeo (se existir)

## Entregáveis (o que vai mudar)
- Frontend:
  - `src/pages/public/LivroLandingPage.tsx` (trocar embed por 3 queries simples + logs melhores)
- Banco (migration):
  - Adicionar PK/FKs em `royalties_affiliate_links` (e índices se necessário)

## Riscos e como vamos evitar
- Risco: criar FK pode falhar se existir algum link com `livro_id/autor_id` inválido.
  - Mitigação: rodar query de verificação antes da migration e corrigir dados órfãos (se existirem).
- Risco: usuários ainda verem cache.
  - Mitigação: após publicar, testar em janela anônima e, se necessário, hard refresh.

## Observação importante sobre urgência
A parte A (frontend sem embed) resolve mesmo que a produção esteja em um estado “meio inconsistente” no banco.  
A parte B deixa o banco correto para não voltar a quebrar quando vocês criarem novos links.

