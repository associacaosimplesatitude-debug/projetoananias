

## Diagnóstico

O erro **131008** "Button at index 0 of type Url requires a parameter" ocorre porque:

1. O template `revista_ebd_oferta_sem_desconto` tem um **botão URL dinâmico** (`url_dinamica: true`)
2. Mas suas `variaveis_usadas` são apenas `[primeiro_nome, data_pedido]` — **não inclui `link_oferta`**
3. A lógica atual só gera o link quando `usesLinkOferta` é true (baseado em `variaveis_usadas`)
4. Como `linkOferta` fica vazio, a condição `btn.url_dinamica && linkOferta` na linha 243 é false
5. O componente de botão nunca é adicionado, mas Meta exige o parâmetro

## Plano de Correção

### Arquivo: `supabase/functions/whatsapp-send-campaign/index.ts`

**Alterar a detecção de `usesLinkOferta`** para também verificar se o template tem botões com `url_dinamica: true`:

```typescript
// Antes (só checa variaveis_usadas):
const usesLinkOferta = variables.some(v => ... === "link_oferta");

// Depois (também checa botões dinâmicos):
const botoes = typeof template?.botoes === 'string' 
  ? JSON.parse(template.botoes) : (template?.botoes || []);
const hasUrlDinamica = botoes.some((b: any) => b.url_dinamica === true);
const usesLinkOferta = hasUrlDinamica || variables.some(v => ... === "link_oferta");
```

**Mover o parse de `botoes`** para antes do loop de destinatários (evitar re-parse dentro do loop).

**Remover a condição `&& linkOferta`** na adição do botão (linha 243), pois após a correção acima, `linkOferta` sempre estará preenchido quando há botão dinâmico.

### Resultado
- Links de oferta serão gerados para todos os destinatários quando o template tiver botão dinâmico
- O componente `button` será corretamente incluído no payload
- Meta aceitará o envio

