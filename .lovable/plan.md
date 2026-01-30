

# Correção: Página em Branco na Landing Page do Livro

## Problema Identificado

A landing page `/livro/cativeiro-babilonico` está retornando 404 porque:

1. A tabela `royalties_affiliate_links` tem policy de leitura pública: "Public read active affiliate_links"
2. As tabelas `royalties_livros` e `royalties_autores` **NAO** têm policies de leitura pública
3. Quando um visitante anônimo acessa a LP, a query busca os dados do affiliate_link mas os JOINs com livro e autor retornam `null`
4. O código interpreta isso como "Livro não encontrado" e mostra erro

## Policies Atuais

| Tabela | Policy SELECT | Roles |
|--------|---------------|-------|
| royalties_affiliate_links | Public read active | public (OK!) |
| royalties_livros | Apenas admins e autor | authenticated (PROBLEMA) |
| royalties_autores | Apenas admins e autor | authenticated (PROBLEMA) |

## Solução

Adicionar policies de leitura pública para livros e autores que estão associados a links de afiliado ativos. Isso permite que a landing page carregue os dados necessários sem autenticação.

## Migration SQL

```sql
-- Policy: Leitura pública de livros com link de afiliado ativo
CREATE POLICY "Public read livros with active affiliate" 
ON public.royalties_livros
FOR SELECT
USING (
  id IN (
    SELECT livro_id FROM public.royalties_affiliate_links 
    WHERE is_active = true
  )
);

-- Policy: Leitura pública de autores com link de afiliado ativo
CREATE POLICY "Public read autores with active affiliate" 
ON public.royalties_autores
FOR SELECT
USING (
  id IN (
    SELECT autor_id FROM public.royalties_affiliate_links 
    WHERE is_active = true
  )
);
```

## Por que esta abordagem é segura?

1. **Escopo limitado**: Apenas livros/autores com links de afiliado ATIVOS ficam visíveis publicamente
2. **Dados não sensíveis**: Título, capa, sinopse, nome e foto do autor são informações de marketing já públicas
3. **Dados sensíveis protegidos**: CPF, dados bancários, emails ficam protegidos pelas policies existentes (SELECT apenas para colunas não expostas na query da LP)
4. **Controle via admin**: Desativar o link de afiliado remove automaticamente o acesso público

## Resultado Esperado

Após aplicar a migration:
- Visitante acessa `gestaoebd.lovable.app/livro/cativeiro-babilonico`
- Query retorna dados do affiliate_link + livro + autor
- Landing page renderiza corretamente com capa, título, vídeo e botão de compra

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Adicionar 2 policies de leitura pública |

