
# Plano: Corrigir Mapeamento de "Frete Grátis" no Bling

## Problema
Quando o método de frete é **"Frete Grátis"** (`metodo_frete = 'free'`), o sistema envia `servico: 'FRETE GRATIS'` para o Bling. O Bling não reconhece essa string como um serviço logístico válido, resultando no erro "Novo ID Logístico encontrado" e defaultando para "RETIRADA".

## Solução
Alterar o mapeamento para enviar `'PAC CONTRATO AG'` (serviço válido no Bling) quando o frete for grátis, mantendo o valor do frete como R$ 0,00 e adicionando uma observação clara no pedido.

## Alterações

### Arquivo: `supabase/functions/bling-create-order/index.ts`

**1. Atualizar o mapeamento de frete (linha 2130):**

```text
// DE:
'free': { nome: 'Frete Grátis', servico: 'FRETE GRATIS' },

// PARA:
'free': { nome: 'Correios', servico: 'PAC CONTRATO AG' },
```

**2. Adicionar indicação de "FRETE GRÁTIS" nas observações (após linha 2170):**

```javascript
// Adicionar indicação de frete grátis
if (metodo_frete?.toLowerCase() === 'free') {
  observacoesBase.push('🚚 FRETE GRÁTIS');
}
```

## Resultado Esperado

| Campo no Bling | Antes | Depois |
|----------------|-------|--------|
| ID Serviço Logístico | "FRETE GRATIS" (não reconhecido) → "RETIRADA" | "PAC CONTRATO AG" ✓ |
| Valor do Frete | R$ 0,00 | R$ 0,00 (sem alteração) |
| Observações | Sem indicação | "🚚 FRETE GRÁTIS" |

## Impacto
- **Pedidos novos**: Aparecerão corretamente com "PAC CONTRATO AG" no Bling
- **Pedidos antigos**: Permanecem como estavam (não há correção retroativa)
- **Clareza**: A observação "🚚 FRETE GRÁTIS" indica para a equipe de expedição que é uma cortesia/promoção
