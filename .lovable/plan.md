

# Ajustar textos das mensagens do funil pos-venda

## Contexto
As mensagens estao chegando como texto simples (sem botoes). Agora precisamos ajustar o conteudo para manter a sequencia desejada.

## Alteracoes

### 1. Mensagem 1 - Gancho de Credibilidade (`ebd-shopify-order-webhook/index.ts`, linha 751)
Ajustar o texto da `fase1Msg` para:
- Terminar com a pergunta "Quer acompanhar o prazo de entrega e o codigo de rastreio em tempo real?"
- Adicionar na linha seguinte o texto clicavel: `SIM, QUERO 👉 {trackerUrl}`
- Isso mantem o "call to action" claro mesmo sem botao interativo

### 2. Mensagem 2 - Entrega do Acesso (`whatsapp-link-tracker/index.ts`, linha 89)
Ajustar o texto da `msg2` para:
- Comecar com "Excelente! 🎉"
- Incluir "criamos um painel exclusivo para voce acompanhar sua entrega e ja comecar a organizar suas aulas"
- Mostrar credenciais (email e senha)
- Incluir link do painel: "Acesse aqui: {PANEL_URL}/login/ebd"
- Finalizar com: "Alem do rastreio, voce acaba de ganhar acesso ao sistema Gestao EBD para gerenciar suas turmas!"

### 3. Teste
Reenviar Mensagem 1 para 5511986216465 para validar o novo formato

## Secao Tecnica

**Mensagem 1 (fase1Msg) - novo texto:**
```
Ola, {nome}! 👋

Recebemos seu pedido na Central Gospel! Obrigado pela confianca.

Resumo do Pedido:
📦 Item: {itens}
🚚 Frete: R$ {frete}
✨ Total: R$ {total}

Quer acompanhar o prazo de entrega e o codigo de rastreio em tempo real?

SIM, QUERO 👉 {trackerUrl}
```

**Mensagem 2 (msg2) - novo texto:**
```
Excelente! 🎉

Para facilitar, criamos um painel exclusivo para voce acompanhar sua entrega e ja comecar a organizar suas aulas.

Seus dados de acesso:
📧 E-mail: {email}
🔑 Senha: {senha}

Acesse aqui: {PANEL_URL}/login/ebd

Alem do rastreio, voce acaba de ganhar acesso ao sistema Gestao EBD para gerenciar suas turmas!
```

