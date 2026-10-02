# Adicionar aba Templates ao Marketing

## Alteração
- Importar `WhatsAppTemplatesList` em `MarketingPanel.tsx`.
- Inserir a aba **Templates** entre **Campanhas** e **Públicos**.
- Renderizar `WhatsAppTemplatesList` no conteúdo da nova aba.
- Reutilizar o botão **Novo Template** e o fluxo de edição já internos à lista, sem duplicar estado ou formulário.

## Validação
- Confirmar que a compilação permanece válida e que as demais abas não foram alteradas.
