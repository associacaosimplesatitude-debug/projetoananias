
# Plano: Remover Fundo Azul do Header dos Emails

## Objetivo

Remover o fundo azul escuro do header em todos os 6 templates de email, deixando o logo da Central Gospel sobre fundo branco.

## O que sera alterado

O CSS do header em todos os templates sera modificado:

**Antes:**
```css
.header{background:linear-gradient(135deg,#1a2d40,#2d4a5e);padding:30px;text-align:center}
```

**Depois:**
```css
.header{background:#ffffff;padding:30px;text-align:center}
```

## Templates afetados

| Template | Status |
|----------|--------|
| `autor_acesso` | Remover fundo azul |
| `royalty_venda` | Remover fundo azul |
| `pagamento_realizado` | Remover fundo azul |
| `relatorio_mensal` | Remover fundo azul |
| `afiliado_venda` | Remover fundo azul |
| `afiliado_link` | Remover fundo azul |

## Resultado visual

O header passara a ter fundo branco, mantendo o logo da Central Gospel Editora visivel e limpo, sem o degradê azul escuro.

---

## Secao Tecnica

Sera executado um UPDATE via SQL em todos os 6 templates, substituindo:

- `background:linear-gradient(135deg,#1a2d40,#2d4a5e)` por `background:#ffffff`

O footer tambem possui `background:#1a2d40` - se desejar remover tambem, me avise. Por enquanto, apenas o header sera alterado conforme solicitado.
