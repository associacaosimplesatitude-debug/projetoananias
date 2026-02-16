

# Funil de Pos-Venda E-commerce -- Automacao WhatsApp

## Contexto Atual

Hoje existe um funil visual com 6 etapas (`VendedorFunil.tsx`), mas ele e apenas informativo -- nao dispara mensagens automaticas. O sistema de onboarding do cliente (`OnboardingProgressCard`) ja rastreia 7 etapas internas (aplicar revista, criar turma, cadastrar professor, definir data, criar escala, aniversario, configurar lancamento).

Dos 98 clientes marcados como `is_pos_venda_ecommerce`, apenas 4 fizeram login e nenhum completou o onboarding.

## Proposta: Funil de Pos-Venda com 5 Fases + Mensagens Automaticas

O objetivo e guiar o cliente desde a primeira compra ate o uso ativo do sistema, usando WhatsApp como canal principal de comunicacao.

---

### FASE 1 -- BEM-VINDO (Primeira Compra Aprovada)

**Gatilho:** Pedido pago no Shopify (status `paid`) + cliente criado em `ebd_clientes`

**Mensagem (imediata):**
```
Ola [NOME]! Sua compra foi confirmada!

Acompanhe o status do seu pedido, codigo de rastreio e muito mais pelo nosso painel exclusivo:

[LINK DO PAINEL]

Seu acesso:
Email: [EMAIL]
Senha: [SENHA_TEMPORARIA]

Acesse agora e veja o andamento do seu pedido!
```

**Botao com link rastreavel:** O link do painel sera um link intermediario (via Edge Function `whatsapp-link-tracker`) que registra o clique antes de redirecionar. Isso permite saber se o cliente abriu a mensagem e clicou no link.

**Rastreamento:**
- Mensagem enviada (registro em `whatsapp_mensagens`)
- Link clicado (registro em tabela `funil_posv_tracking`)
- Login realizado (campo `ultimo_login` em `ebd_clientes`)

---

### FASE 2 -- LEMBRETE DE LOGIN (Nao se logou em 2 dias)

**Gatilho:** 48h apos a Fase 1 E `ultimo_login IS NULL`

**Mensagem:**
```
Ola [NOME]! Seu pedido ja esta sendo preparado.

Voce sabia que pode acompanhar tudo em tempo real pelo painel? Ainda nao vimos seu acesso.

Entre agora com:
Email: [EMAIL]
Senha: [SENHA_TEMPORARIA]

[LINK DO PAINEL]

Ganhe ate 30% de desconto na proxima compra respondendo apenas 3 perguntas rapidas apos o login!
```

---

### FASE 3 -- ONBOARDING (Logou mas nao completou o setup)

**Gatilho:** `ultimo_login IS NOT NULL` E `onboarding_concluido = false`

**Mensagem 3A (imediata apos primeiro login):**
```
Parabens [NOME]! Voce acessou o painel com sucesso!

Agora complete 3 perguntas rapidas e ganhe ate 30% de desconto na sua proxima compra. Leva menos de 2 minutos!

[LINK DO PAINEL]
```

**Mensagem 3B (3 dias apos 3A se onboarding nao concluido):**
```
[NOME], falta pouco para garantir seu desconto de ate 30%!

Voce so precisa responder 3 perguntinhas rapidas. Nao perca essa oportunidade!

[LINK DO PAINEL]
```

---

### FASE 4 -- CONFIGURACAO DA ESCALA (Onboarding concluido, escala nao criada)

**Gatilho:** `onboarding_concluido = true` E nenhuma escala cadastrada para o `church_id`

**Mensagem 4A (imediata apos onboarding):**
```
Fantastico [NOME]! Seu desconto de [X]% ja esta garantido!

Agora configure a escala de professores da sua EBD e tenha tudo organizado automaticamente. E rapido e facil!

[LINK ESCALA]
```

**Mensagem 4B (5 dias apos 4A se escala nao criada):**
```
[NOME], voce ja garantiu seu desconto! Que tal dar o proximo passo?

Configure a escala da sua EBD e deixe tudo organizado para o trimestre. Seus professores vao agradecer!

[LINK ESCALA]
```

---

### FASE 5 -- ATIVO / ENGAJADO (Escala configurada)

**Gatilho:** Escala criada com sucesso

**Mensagem (unica, parabenizacao):**
```
Parabens [NOME]! Sua EBD esta 100% configurada no sistema!

Agora voce pode acompanhar frequencia, devocionais, ranking de alunos e muito mais. Tudo automatico!

Seu desconto de [X]% esta disponivel para a proxima compra. Aproveite!

[LINK CATALOGO]
```

---

## Regras de Disparo

1. **Apenas clientes novos** (primeira compra a partir de Jan/2026, flag `is_pos_venda_ecommerce = true`)
2. **Intercalar dias** -- nunca enviar duas mensagens no mesmo dia
3. **Maximo 1 mensagem por fase** (exceto Fase 3 e 4 que tem lembretes)
4. **Parar automacao** se o cliente completar a acao da fase atual
5. **Horario de envio:** Entre 9h e 18h (horario de Brasilia)

---

## Implementacao Tecnica

### 1. Nova tabela `funil_posv_tracking`

Registra o progresso de cada cliente no funil automatico:

```text
| Coluna               | Tipo        | Descricao                          |
|----------------------|-------------|------------------------------------|
| id                   | uuid (PK)   | Identificador                      |
| cliente_id           | uuid (FK)   | Referencia ebd_clientes            |
| fase_atual           | integer     | 1-5                                |
| fase1_enviada_em     | timestamptz | Data envio msg fase 1              |
| fase1_link_clicado   | boolean     | Se clicou no link da fase 1        |
| fase2_enviada_em     | timestamptz | Data envio msg fase 2              |
| fase3a_enviada_em    | timestamptz | Data envio msg fase 3A             |
| fase3b_enviada_em    | timestamptz | Data envio msg fase 3B             |
| fase4a_enviada_em    | timestamptz | Data envio msg fase 4A             |
| fase4b_enviada_em    | timestamptz | Data envio msg fase 4B             |
| fase5_enviada_em     | timestamptz | Data envio msg fase 5              |
| concluido            | boolean     | Se completou todas as fases        |
| created_at           | timestamptz | Data criacao                       |
| updated_at           | timestamptz | Data atualizacao                   |
```

### 2. Nova Edge Function `funil-posv-cron`

Funcao agendada (cron) que roda 1x/dia verificando:
- Clientes na Fase 1 sem login apos 48h -> envia Fase 2
- Clientes que logaram mas nao completaram onboarding -> envia Fase 3A
- Clientes com 3A enviada ha 3 dias sem onboarding -> envia Fase 3B
- Clientes com onboarding completo sem escala -> envia Fase 4A
- Clientes com 4A enviada ha 5 dias sem escala -> envia Fase 4B
- Clientes com escala criada -> envia Fase 5

### 3. Nova Edge Function `whatsapp-link-tracker`

Endpoint publico que recebe cliques dos links das mensagens:
- Registra o clique em `funil_posv_tracking`
- Redireciona para a URL real do painel

### 4. Trigger ou Hook no cadastro de cliente

Quando um novo cliente `is_pos_venda_ecommerce` e criado, insere registro em `funil_posv_tracking` e dispara a mensagem da Fase 1 imediatamente.

### 5. Visualizacao no Funil Admin

Adicionar no funil existente (`VendedorFunil.tsx`) indicadores visuais de qual fase de WhatsApp cada cliente esta, com badges de status (Enviada, Clicada, Respondida).

---

## Resumo de Arquivos

| Acao   | Arquivo                                          |
|--------|--------------------------------------------------|
| Criar  | Migracao SQL para tabela `funil_posv_tracking`   |
| Criar  | `supabase/functions/funil-posv-cron/index.ts`    |
| Criar  | `supabase/functions/whatsapp-link-tracker/index.ts` |
| Editar | `supabase/functions/send-whatsapp-message/index.ts` (suportar tipo funil) |
| Editar | `src/pages/vendedor/VendedorFunil.tsx` (badges WhatsApp por fase) |
| Criar  | SQL para cron job diario                         |

