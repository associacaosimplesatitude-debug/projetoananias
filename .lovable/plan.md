## Diagnóstico

Investiguei o código atual de `src/pages/admin/RevistasDigitais.tsx` e o badge laranja "Lição {numero}" **já foi removido** em commit anterior (`cf63e955`). O código atual (linhas 829–842) renderiza apenas:

- Ícone de arrastar (GripVertical)
- Badge "5 páginas" / "Sem páginas" (variante padrão do tema, que pode aparecer com tom escuro/dourado)
- Indicador "Reordenando..." quando aplicável

Não existe mais nenhum `<Badge>Lição {licao.numero}</Badge>` no arquivo.

A imagem enviada provavelmente reflete um **cache do navegador / Service Worker** com a versão antiga (há um erro de Service Worker registrado: redirect bloqueado em `/sw.js`, o que impede a atualização do bundle).

## Plano de ação

### 1. Auditoria final do código (garantia)
Rodar busca em todo `src/` por qualquer ocorrência remanescente de badge "Lição N" com classe laranja em telas administrativas e em componentes filhos do fluxo `/admin/ebd/revistas-digitais`. Se encontrar, remover mantendo apenas o título da lição (input).

### 2. Forçar invalidação do Service Worker / cache do PWA
O console mostra:
```
Failed to update a ServiceWorker ... script resource is behind a redirect
```
Isso significa que o navegador continua servindo a versão antiga da página administrativa.

Ações:
- Inspecionar `public/sw.js` e o registro do Service Worker em `index.html` / `main.tsx`.
- Garantir que rotas administrativas (`/admin/*`) **não** sejam interceptadas pelo SW (já é boa prática — só PWA do leitor deve ser cacheada).
- Adicionar `self.skipWaiting()` + `clients.claim()` no SW e bumpar a versão para forçar atualização imediata em todos os clients.

### 3. Comunicar ao usuário
Após o deploy, instruir um hard refresh (Ctrl+Shift+R) ou desinstalar o SW pelas DevTools para validar que a tag "Lição 4" laranja sumiu.

## Resultado esperado

No card de cada lição em `/admin/ebd/revistas-digitais` ao gerenciar lições, restará apenas:
- Ícone de arrastar
- Badge "N páginas"
- Miniatura da primeira página
- Input com o título escrito (ex.: "Lição 02 – A Graça Salvadora e Seus Efeitos — Efésios 2–3")

Sem qualquer pílula laranja "Lição {numero}".