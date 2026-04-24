## Problema

A página `https://gestaoebd.com.br/sorteio` está mostrando a versão antiga em navegadores normais, mas a versão nova aparece em modo anônimo. Causa: **service worker do PWA** está servindo o HTML/JS/CSS antigo do cache.

## Solução imediata (você pode fazer agora, sem código)

Para visualizar a versão nova **agora mesmo** no seu navegador:

1. Abra `https://gestaoebd.com.br/sorteio`
2. Pressione **Ctrl + Shift + R** (Windows) ou **Cmd + Shift + R** (Mac) — hard refresh
3. Se ainda aparecer a versão antiga: abra **DevTools (F12)** → aba **Application** → **Service Workers** → clique em **Unregister** → depois **Clear storage** → **Clear site data** → recarregue

Isso resolve para o seu navegador. Mas o problema persistirá para **todos os outros visitantes** até que o service worker deles atualize sozinho (pode levar 1–2 visitas).

## Solução definitiva no código

Para garantir que **todos os usuários** recebam a versão nova imediatamente, vou:

### 1. Excluir a rota `/sorteio` do cache do service worker

Adicionar `navigateFallbackDenylist` no `vite.config.ts` para que a rota `/sorteio` (e suas subrotas públicas) **nunca** seja servida do cache — sempre busque do servidor.

```ts
workbox: {
  navigateFallbackDenylist: [/^\/~oauth/, /^\/sorteio/, /^\/admin/],
  // ... resto igual
}
```

### 2. Adicionar meta tag de no-cache na landing /sorteio

Em `SorteioLanding.tsx`, adicionar via `useEffect` headers que instruem o navegador a não cachear o HTML dessa rota específica.

### 3. Forçar atualização do service worker

Já está com `registerType: "autoUpdate"` + `skipWaiting: true` + `clientsClaim: true`, então usuários que abrirem 2 vezes já receberão a versão nova automaticamente. Adicionar um `<meta name="version">` com timestamp no `index.html` ajuda a detectar mudanças.

## Arquivos afetados

- `vite.config.ts` — adicionar denylist
- `src/pages/public/SorteioLanding.tsx` — meta no-cache (opcional)

## Resultado esperado

- Navegadores que já têm o site instalado/cacheado vão buscar a rota `/sorteio` direto do servidor sempre.
- Próxima visita carrega a versão nova com banner correto, prêmio dinâmico, etc.
- Você ainda precisará fazer **um hard refresh** (Ctrl+Shift+R) no seu navegador para limpar o cache antigo já existente.

Posso aplicar?