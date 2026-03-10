

## Plano: Correção robusta do erro 131008 (botão dinâmico)

### Problema
O erro persiste porque:
1. O parse de `botoes` pode falhar silenciosamente
2. O `linkToken` é declarado dentro do bloco `usesLinkOferta` mas referenciado fora dele na montagem do botão
3. O `index` do botão é passado como `String(idx)` mas a Meta espera um número
4. A condição `btn.url_dinamica` pode não coincidir se o campo tiver valor diferente

### Alterações no arquivo `supabase/functions/whatsapp-send-campaign/index.ts`

**1. Linhas 102-111** — Substituir parse de botões por versão robusta com try/catch:
```typescript
const botoes = (() => {
  try {
    const raw = template?.botoes;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return []; }
})();

const hasUrlDinamica = botoes.some((b: any) => b.tipo === 'URL' && b.url_dinamica === true);
const usesLinkOferta = hasUrlDinamica || variables.some(
  (v: string) => v.replace(/\{\{|\}\}/g, "").trim() === "link_oferta"
);

console.log("[send-campaign] botoes:", JSON.stringify(botoes));
console.log("[send-campaign] hasUrlDinamica:", hasUrlDinamica, "usesLinkOferta:", usesLinkOferta);
```

**2. Linhas 124-125** — Mover `linkToken` para escopo acessível e garantir geração sempre:
```typescript
let linkOferta = "";
let linkToken = "";
let linkRecord: any = null;
```

**3. Linha 176** — Atribuir ao `linkToken` do escopo externo:
```typescript
linkToken = crypto.randomUUID();
```

**4. Linhas 243-254** — Substituir montagem do botão para usar `hasUrlDinamica` sem condição extra, com `index` numérico e usando `linkToken` diretamente:
```typescript
// Add dynamic URL button components - ALWAYS when hasUrlDinamica
if (hasUrlDinamica) {
  components.push({
    type: "button",
    sub_type: "url",
    index: 0,
    parameters: [{ type: "text", text: linkToken }],
  });
}
```

**5. Antes do fetch (linha 256)** — Adicionar log do payload:
```typescript
console.log("[send-campaign] Payload para", phone, ":", JSON.stringify(payload, null, 2));
```

### Resultado
- `linkToken` sempre disponível quando `usesLinkOferta` é true
- Botão dinâmico sempre incluído quando template tem URL dinâmica
- Log detalhado para confirmar payload correto antes do envio

