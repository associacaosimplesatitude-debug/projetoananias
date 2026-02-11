
# Melhorar botoes dos emails - Cores da Central Gospel Editora

## Problema
Os botoes nos templates de email usam `background:#1a2d40` (azul escuro/navy), que tem baixo contraste e fica quase ilegivel, como mostrado na imagem do email "Acessar o Sistema".

## Solucao
Atualizar todos os templates de email no banco de dados para usar as cores do logo da Central Gospel Editora:
- **Botoes**: `background:#B8860B` (Dark Goldenrod/dourado) com texto branco
- **Hover visual**: Padding maior e border-radius para destaque
- **Info-box border**: Tambem atualizar de navy para dourado onde aplicavel

## Templates afetados
Todos os templates que possuem a classe `.btn` serao atualizados via SQL UPDATE:

1. **autor_acesso** (Dados de Acesso) - Botao "Acessar o Sistema"
2. **pagamento_realizado** (Pagamento Confirmado) - Botao "Ver Comprovante"  
3. **afiliado_link** (Link de Afiliado) - Botoes de link/acoes
4. **relatorio_mensal** - Se tiver botao
5. **resgate_solicitado** - Se tiver botao
6. **resgate_aprovado** - Se tiver botao
7. **contrato_novo** - Se tiver botao

## Detalhes tecnicos

Para cada template, substituir no campo `corpo_html`:

**Antes:**
```css
.btn{display:inline-block;background:#1a2d40;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:15px}
```

**Depois:**
```css
.btn{display:inline-block;background:#B8860B;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;margin-top:15px;font-weight:bold;font-size:16px}
```

Tambem atualizar a borda do `.info-box` de `#1a2d40` para `#B8860B` no template `autor_acesso` para manter consistencia visual com a marca.

Sera executado via SQL UPDATE direto nos registros da tabela `royalties_email_templates`, atualizando o campo `corpo_html` de cada template afetado.

Tambem sera atualizado o `sampleData` no componente `EmailPreviewDialog.tsx` para refletir as cores na preview, caso necessario.
