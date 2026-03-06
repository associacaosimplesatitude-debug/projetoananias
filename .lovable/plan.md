

## Plano: Mostrar percentual de desconto na coluna

### Alterações

1. **Migration — Atualizar RPC `get_publicos_revistas_por_mes`**
   - No CTE `contatos_com_desconto`, adicionar `dcr.percentual_desconto` ao SELECT
   - Incluir `percentual_desconto` no `JSON_BUILD_OBJECT` do resultado final

2. **Editar `WhatsAppPublicos.tsx`**
   - Adicionar `percentual_desconto: number | null` à interface `Contato`
   - Na coluna "Desconto", em vez de apenas "Sim"/"Não", mostrar o percentual quando existir (ex: badge verde "10%"), e "Não" quando não tiver desconto

