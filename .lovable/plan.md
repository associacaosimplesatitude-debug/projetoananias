

# Corrigir URLs dos Templates de Email e Código

## Problema
Todos os 9 templates de email salvos no banco de dados usam `gestaoebd.lovable.app` nas imagens do logo. Alem disso, alguns arquivos no codigo fonte tambem referenciam o dominio antigo.

## Alteracoes

### 1. Atualizar todos os 9 templates no banco de dados
Executar um UPDATE em `royalties_email_templates` para substituir `gestaoebd.lovable.app` por `gestaoebd.com.br` em todos os templates:

Templates afetados:
- autor_acesso (Dados de Acesso)
- royalty_venda (Aviso de Venda)
- pagamento_realizado (Pagamento Confirmado)
- afiliado_link (Link de Afiliado)
- afiliado_venda (Venda via Afiliado)
- relatorio_mensal (Relatorio Mensal)
- resgate_aprovado (Resgate Aprovado)
- resgate_solicitado (Resgate Solicitado)
- contrato_novo (Novo Contrato)

### 2. Atualizar referencias no codigo fonte

**`src/components/royalties/EmailPreviewDialog.tsx`**:
- Atualizar `link_afiliado` de exemplo que ainda usa `gestaoebd.lovable.app`

**`src/components/vendedor/PlaybookClienteCard.tsx`**:
- Atualizar link do painel de `gestaoebd.lovable.app/ebd/login` para `gestaoebd.com.br/ebd/login`

**`src/pages/vendedor/VendedorPosVenda.tsx`**:
- Atualizar link do painel de `gestaoebd.lovable.app/ebd/login` para `gestaoebd.com.br/ebd/login`

### Resultado
Todos os emails enviados pelo sistema usarao o dominio correto `gestaoebd.com.br`, tanto nas imagens do logo quanto nos links de acesso.
