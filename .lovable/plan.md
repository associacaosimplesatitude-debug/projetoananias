

# Corrigir redirecionamento do "SIM, QUERO" - Mostrar pagina de confirmacao

## Problema
Ao clicar em "SIM, QUERO", a pessoa e redirecionada para a tela de login (`/login/ebd`), mas ainda nao recebeu as credenciais (que serao enviadas pela Mensagem 2 no WhatsApp). Isso causa confusao.

## Solucao
Em vez de redirecionar para `/login/ebd`, redirecionar para uma pagina intermediaria que informe ao usuario para verificar o WhatsApp. A Mensagem 2 (com credenciais) ja e disparada automaticamente pelo `whatsapp-link-tracker` -- so precisamos mudar o destino do redirecionamento.

## Alteracoes

### 1. Criar pagina de confirmacao (`src/pages/ConfirmacaoWhatsApp.tsx`)
Uma pagina simples e bonita que exibe:
- "Seus dados de acesso foram enviados no WhatsApp!"
- "Verifique suas mensagens para obter o email e senha de acesso."
- Icone de WhatsApp e checkmark
- Botao secundario "Ja recebi, quero fazer login" apontando para `/login/ebd`

### 2. Registrar a rota no App.tsx
Adicionar rota `/confirmacao-whatsapp` apontando para a nova pagina.

### 3. Atualizar o redirecionamento no `whatsapp-link-tracker/index.ts`
Mudar o redirect padrao de `/login/ebd` para `/confirmacao-whatsapp`:
- Linha 10: trocar `"/login/ebd"` por `"/confirmacao-whatsapp"`

### 4. Atualizar a URL do tracker no `ebd-shopify-order-webhook/index.ts`
Remover o parametro `r=/login/ebd` da URL do tracker (ja que o padrao agora sera `/confirmacao-whatsapp`).

## Secao Tecnica

**whatsapp-link-tracker/index.ts - linha 10:**
```
// Antes:
const redirect = url.searchParams.get("r") || "/login/ebd";

// Depois:
const redirect = url.searchParams.get("r") || "/confirmacao-whatsapp";
```

**Nova pagina ConfirmacaoWhatsApp.tsx:**
- Pagina publica (sem autenticacao)
- Layout centralizado com card
- Icone de sucesso + mensagem orientando verificar WhatsApp
- Botao "Ja recebi, ir para login" linkando para `/login/ebd`

**Fluxo corrigido:**
```text
Msg 1 ("SIM, QUERO 👉 link")
  → Usuario clica no link
  → whatsapp-link-tracker:
      1. Registra clique
      2. Dispara Msg 2 (credenciais) via WhatsApp
      3. Redireciona para /confirmacao-whatsapp (pagina amigavel)
  → Usuario ve: "Enviamos seus dados no WhatsApp!"
  → Usuario recebe Msg 2 no WhatsApp com email/senha
  → Usuario clica "Ir para login" quando pronto
```
