# Corrigir página /sorteio

## Diagnóstico

Verifiquei o banco e a página `/sorteio`:

**No banco está tudo certo:**
- O evento **"Conferência Leoas 2026"** está marcado como ATIVO ✅
- Tem `titulo`, `subtitulo`, `descricao`, `premio_destaque`, `texto_botao_cta`, `cor_primaria` (#D4AF37) e `banner_url` preenchidos ✅
- O evento "AGE 2026" está inativo ✅

**O problema está no código de `src/pages/public/SorteioLanding.tsx`:**

1. **Imagem do prêmio hardcoded** (linha 385): mostra sempre `PREMIO_URL` (Kit Gotas de Consolo da Eyshila), independente do evento ativo. Por isso, mesmo com o evento Leoas ativo, aparece o prêmio antigo.

2. **Alt do prêmio hardcoded** (linha 386): "Kit Gotas de Consolo — Eyshila Santos".

3. **Banner ocupa pouco espaço no desktop**: usa `object-contain` sem altura mínima — em telas largas o banner fica pequeno e o conteúdo "some" visualmente acima da dobra.

4. **Banner_url atual no banco** é `logo_gestao.png` (uma logo, não a arte das pastoras Leoas) — provavelmente foi sobrescrito por engano no último upload. Vou avisar o usuário no final.

## Correções

### 1. `src/pages/public/SorteioLanding.tsx`

**Substituir a imagem hardcoded do prêmio pelo banner do evento como imagem de prêmio**, ou usar um novo campo. Como não há campo `imagem_premio_url` na tabela, a melhor abordagem é:

- Usar `evento.banner_url` quando o evento tiver banner próprio, e remover a imagem hardcoded `PREMIO_URL` do bloco de prêmio.
- Ou (melhor): adicionar coluna `imagem_premio_url` em `sorteio_eventos` e um campo no `EventoDialog` para upload separado.

**Decisão**: adicionar coluna `imagem_premio_url` (opcional). Se vazia, cai no `PREMIO_URL` antigo como fallback. Atualizar `EventoDialog` para permitir upload da imagem do prêmio.

- Trocar `src={PREMIO_URL}` por `src={evento.imagem_premio_url || PREMIO_URL}`.
- Trocar `alt="Kit Gotas de Consolo — Eyshila Santos"` por `alt={premioDestaque}`.

### 2. Banner desktop

Limitar altura máxima e centralizar:
- Trocar `className="w-full h-auto object-contain mx-auto"` por `className="w-full max-h-[480px] object-cover object-center"` (em mobile mantém altura natural; em desktop limita).

### 3. Migration

Adicionar coluna na tabela:
```sql
ALTER TABLE public.sorteio_eventos ADD COLUMN imagem_premio_url text;
```

### 4. `EventoDialog.tsx`

Adicionar campo de upload de "Imagem do prêmio" (mesmo padrão do upload de banner).

## Aviso ao usuário

O `banner_url` atual do evento "Conferência Leoas 2026" aponta para um arquivo chamado `logo_gestao.png` (parece ser uma logo, não a arte das pastoras Leoas). Após as correções, recomendo reenviar o banner correto pelo painel admin.
