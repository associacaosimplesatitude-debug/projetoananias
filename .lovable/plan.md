# Correção: campanha "aviso advecs" — erro #100 da Meta

## Causa raiz (confirmada pela API da Meta)

O template `aviso_novo_numero_central_gospel` está **APROVADO** pela Meta como `en_US` (a língua é só um rótulo, não importa o idioma do conteúdo). O problema **não é** a língua.

O template foi aprovado usando **parâmetros nomeados** (named parameters), não posicionais. A definição na Meta retorna:

```json
"example": {
  "body_text_named_params": [
    { "param_name": "lead_nome", "example": "John Doe" }
  ]
}
```

Para templates com parâmetro nomeado, a Meta exige que cada `parameter` no `components[].parameters` inclua o campo `parameter_name`:

```json
{ "type": "text", "parameter_name": "lead_nome", "text": "João" }
```

A função `whatsapp-send-campaign` hoje envia apenas posicional:

```ts
parameters: varValues.map((v) => ({ type: "text", text: v }))
```

→ Meta responde **(#100) Invalid parameter** e marca os 50 destinatários como `failed`. Os outros 94 continuam `pendente` porque a campanha foi pausada.

## O que vai ser feito

### 1. Edge Function `whatsapp-send-campaign` — suportar named params

Trocar a montagem do `body` para incluir `parameter_name` quando a variável não for numérica (`{{1}}`, `{{2}}` etc):

```ts
components.push({
  type: "body",
  parameters: variables.map((rawVar, i) => {
    const name = String(rawVar).replace(/\{\{|\}\}/g, "").trim();
    const value = varValues[i];
    const isPositional = /^\d+$/.test(name);
    return isPositional
      ? { type: "text", text: value }
      : { type: "text", parameter_name: name, text: value };
  }),
});
```

Mantém 100% de compatibilidade com templates antigos (posicionais).

### 2. Reset dos 50 destinatários que falharam

Após o deploy, voltar status `failed` → `pendente` apenas para essa campanha (limpar `erro_codigo`, `erro_mensagem`, `falhou_em`, `meta_message_id`). Os 94 que ainda estão `pendente` permanecem.

### 3. Retomar a campanha

`status = 'agendada'`, `agendada_para = now()`. No próximo tick do cron (≤5 min) os 144 destinatários são processados em lotes de 50.

## O que NÃO vai ser alterado

- `whatsapp_templates` (template está correto — Meta confirma `en_US`).
- `whatsapp-sync-templates-from-meta`, `whatsapp-cron-processar-campanhas`.
- RPCs de público, UI de campanhas, relatório de entrega, tracking pós-clique.
- Lógica de header de imagem, botões dinâmicos, cálculo de variáveis.

## Detalhes técnicos

- Mudança isolada nas linhas 325–330 de `supabase/functions/whatsapp-send-campaign/index.ts`.
- Reset + retomada via 1 migration SQL pontual (escopo: somente campanha `a837230e-9ab8-4e53-9863-7ec66d66ff94`).
- Não é necessário rodar `Sincronizar templates da Meta` — o template já está coerente, e o sync continuaria gravando `en_US` (que é o que a Meta retorna).

## Validação após deploy

1. Cron tick (≤5 min) → campanha vai para `processando`.
2. `whatsapp_campanha_destinatarios` deve mostrar `sent` aumentando em lotes de 50.
3. Em `/admin/campaign-tracking/a837230e-…` o "Relatório de Entrega" mostra enviados/entregues/lidos crescendo.
4. Se ainda houver `failed`, conferir `erro_mensagem` — deve ser diferente de `(#100) Invalid parameter`.
