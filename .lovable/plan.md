

# Ajustes Finos nas Mensagens WhatsApp do Funil

## Resumo das 5 alteracoes

### 1. Primeira mensagem: adicionar destaque para acompanhamento do pedido
Adicionar uma secao em destaque na primeira mensagem informando que o cliente pode acompanhar o pedido (rastreio, status) diretamente pelo sistema, logo apos a secao de pagamento confirmado. Algo como:

```
-- Pagamento confirmado! --

Acompanhe seu pedido em tempo real!
Pelo sistema voce consulta status, codigo de rastreio e historico de compras.
```

### 2. Primeira mensagem: enviar junto a imagem do painel
A Edge Function `send-whatsapp-message` ja suporta o campo `imagem_url`. Sera necessario:
- Fazer upload do screenshot do dashboard (a imagem de referencia do painel do superintendente) para o bucket publico `apresentacao-screenshots`
- Usar a URL publica dessa imagem no campo `imagem_url` ao enviar a primeira mensagem
- Quando `imagem_url` esta presente, a Z-API usa o endpoint `send-image` com `caption` (a mensagem de texto vai como legenda da imagem)

### 3. Reduzir emojis - tom mais profissional
Remover a maioria dos emojis das duas mensagens. Manter no maximo 2-3 emojis estrategicos (ex: check de pagamento, seta para link). Atualizar tambem a regra no `SYSTEM_PROMPT` do webhook para instruir a IA a usar emojis com mais moderacao.

Antes:
```
Ola! (aceno)
(caixa) Pedido #TEST-001
(sacola) Kit EBD...
(caminhao) Frete...
(dinheiro) Total...
(check) Pagamento confirmado!
(alvo) Voce sabia?
(grafico) Controle de presenca
(calendario) Escala...
```

Depois:
```
Ola!

Recebemos seu pedido na Central Gospel. Aqui esta o resumo:

*Pedido #12345*

- Kit EBD Adultos - Mestre e Aluno (x2) -- R$ 89,90
- Revista EBD Jovens (x1) -- R$ 19,90
- Frete -- R$ 15,20

*Total: R$ 125,00*
Pagamento confirmado.

*Acompanhe seu pedido em tempo real!*
Pelo painel voce consulta o status da entrega, codigo de rastreio e todo o historico de compras.

---

*Voce sabia?* Com a compra, voce tem acesso GRATUITO ao *Sistema Gestao EBD*:

- Controle de presenca dos alunos
- Escala de professores
- Relatorios de frequencia
- Quizzes e gamificacao
- Desafio Biblico com leitura diaria

Responda *SIM* para receber seus dados de acesso ao painel!
```

### 4. Segunda mensagem: enfatizar pedidos e rastreio
Alterar a funcao `handleEnviarCredenciais` no webhook para incluir destaque sobre ver pedidos e rastreio, mantendo as demais funcionalidades:

Antes:
```
Ao entrar, o sistema vai te guiar passo a passo para configurar suas turmas, professores e alunos.
```

Depois:
```
Ao entrar, voce ja pode:
- Acompanhar seu pedido e codigo de rastreio (Menu > Meus Pedidos)
- Configurar turmas, professores e alunos com o guia passo a passo

O sistema vai te orientar em cada etapa.
```

### 5. Melhorar respostas da IA sobre pedidos/rastreio
Atualizar o `SYSTEM_PROMPT` para que a IA sempre direcione o cliente ao sistema primeiro. Quando perguntarem sobre rastreio, a resposta deve ser:

```
Para ver o rastreio do seu pedido:
1. Acesse https://gestaoebd.com.br/login/ebd
2. Faca login com seu e-mail e senha
3. No menu lateral, clique em "Meus Pedidos"
La voce encontra o status e o codigo de rastreio da sua entrega.
```

Adicionar uma secao especifica no SYSTEM_PROMPT sobre "Meus Pedidos" e orientar que o foco e sempre levar o cliente a acessar o sistema.

---

## Secao Tecnica

### Arquivo alterado: `supabase/functions/whatsapp-webhook/index.ts`

**SYSTEM_PROMPT (linhas 9-78)**:
- Adicionar secao "### Meus Pedidos" no conhecimento do sistema, explicando que o cliente pode ver status do pedido, rastreio e historico no menu lateral > Meus Pedidos
- Alterar regra 1 de "use emojis moderadamente" para "use emojis com parcimonia, no maximo 2-3 por mensagem, em tom profissional"
- Adicionar regra: "Quando o cliente perguntar sobre pedido, rastreio ou entrega, sempre oriente a acessar o sistema primeiro: login > Menu > Meus Pedidos"
- Adicionar regra: "O foco principal e sempre levar o cliente a acessar e usar o sistema"

**handleEnviarCredenciais (linhas 395-431)**:
- Reescrever a mensagem de credenciais com menos emojis e com destaque para Meus Pedidos + rastreio
- Manter email, senha e link de acesso

### Template da primeira mensagem (envio manual/automatico)
O template da primeira mensagem nao esta codificado no webhook -- ele e enviado via `send-whatsapp-message`. A alteracao sera no momento do envio (payload), usando:
- `imagem_url`: URL publica do screenshot do dashboard no bucket `apresentacao-screenshots`
- `mensagem`: Texto profissional com secao de acompanhamento de pedido em destaque, menos emojis

### Upload da imagem do painel
- Copiar o screenshot do dashboard (`user-uploads://image-1771352231.png` -- segunda imagem) para o projeto
- Fazer referencia a URL publica do storage para uso no campo `imagem_url`
- Alternativa: se ja existir screenshot do dashboard no bucket, usar a URL existente

### Nenhuma alteracao de logica
O fluxo permanece identico: primeira mensagem com resumo do pedido, cliente responde, webhook processa via IA, credenciais sao enviadas. Apenas o conteudo textual e ajustado.

