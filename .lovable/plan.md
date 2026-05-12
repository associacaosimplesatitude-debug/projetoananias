
# Plano — Roteamento de conversas WhatsApp (gerente → vendedor) + visibilidade por papel

## Decisões confirmadas

- **Encaminhar = pausa total** do agente IA na conversa (só vendedor responde)
- **Vendedor vê histórico completo** da conversa
- **Sem auto-encaminhamento** — gerente sempre escolhe o vendedor manualmente
- **Vendedor acessa via nova rota `/vendedor/whatsapp`**
- **Visibilidade por papel** no `/admin/whatsapp`:
  - **Superadmin (você):** vê TODAS as abas (Conversas, Funil Primeira Compra, Enviar Mensagem, Templates, Campanhas, Públicos, Webhooks, Credenciais API)
  - **Gerente:** vê SOMENTE a aba "Conversas" (todas as conversas)
  - **Vendedor:** vê SOMENTE a aba "Conversas" (filtrada para conversas atribuídas a ele) — via `/vendedor/whatsapp`

## 1. Banco de dados

Migration adicionando em `agente_ia_conversas`:

| Coluna | Tipo | Uso |
|---|---|---|
| `vendedor_atribuido_id` | uuid → vendedores | Vendedor que está atendendo |
| `atribuida_em` | timestamptz | Quando o gerente encaminhou |
| `atribuida_por` | uuid → auth.users | Qual gerente encaminhou |

Índice parcial em `vendedor_atribuido_id` quando não nulo.

**RLS** em `agente_ia_conversas` e `agente_ia_mensagens`:
- Vendedor faz SELECT apenas onde `vendedor_atribuido_id = get_vendedor_id_by_email(get_auth_email())`
- Vendedor faz INSERT em `agente_ia_mensagens` apenas em conversas atribuídas a ele
- Admin/superadmin/gerente mantêm acesso total (políticas atuais)

**RPC `encaminhar_conversa_para_vendedor(conversa_id, vendedor_id)`** (SECURITY DEFINER):
- Checa `has_role(auth.uid(),'admin')` ou role gerente
- Seta `vendedor_atribuido_id`, `atribuida_em`, `atribuida_por`
- Marca `agente_pausado=true`, `status='pausada_humano'`, `motivo_pausa='encaminhada_vendedor'`
- Cria/atualiza registro em `agente_ia_escalations` (motivo `cliente_solicitou_humano`, `vendedor_alvo_id`, status `em_atendimento`)

**RPC `devolver_conversa_para_agente(conversa_id)`** (admin/gerente only):
- Limpa `vendedor_atribuido_id`, reativa agente

## 2. Visibilidade por papel no `/admin/whatsapp`

Criar hook `useWhatsAppRole()` que determina:
- `isSuperAdmin` (papel admin/superadmin)
- `isGerente` (papel gerente)
- `isVendedor` (existe em `vendedores`)

Em `WhatsAppPanel.tsx`:
- Renderizar a lista de tabs dinamicamente conforme o papel
- Superadmin: todas as 8 abas (mantém estado atual)
- Gerente: apenas a aba "Conversas"
- Vendedor que entrar acidentalmente em `/admin/whatsapp` é redirecionado para `/vendedor/whatsapp`

`ProtectedRoute` da rota `/admin/whatsapp` aceita admin **e** gerente.

## 3. Tag de vendedor responsável

Na lista de conversas (gerente e vendedor), tag por linha:

| Estado | Tag | Cor |
|---|---|---|
| `vendedor_atribuido_id` preenchido | `Em atendimento: {nome}` | azul |
| Cliente cadastrado com `ebd_clientes.vendedor_id` mas conversa não atribuída | `Vendedor histórico: {nome}` | verde |
| Cliente cadastrado sem vendedor | `Sem vendedor` | amarelo |
| Telefone sem `cliente_id` | `Novo contato` | cinza |

Lookup: join `agente_ia_conversas → ebd_clientes (cliente_id) → vendedores`.

## 4. Painel do GERENTE (`WhatsAppChat.tsx`)

- Filtros novos na lista: Todas / Aguardando humano / Atribuídas / Não atribuídas
- No header da conversa aberta, botão **"Encaminhar para vendedor"**:
  - Modal com busca por nome de vendedores ativos
  - Mostra "vendedor histórico" como atalho clicável (se houver), mas sem auto-selecionar
  - Confirmação chama RPC `encaminhar_conversa_para_vendedor`
  - Toast + invalidar queries
- Botão "Devolver para o agente" aparece quando a conversa já está atribuída

## 5. Painel do VENDEDOR (nova rota `/vendedor/whatsapp`)

- Item novo no menu de `VendedorLayout` (ícone MessageCircle)
- Página `src/pages/vendedor/VendedorWhatsApp.tsx`:
  - Reaproveita `WhatsAppChat` em modo "vendedor" (prop `scope="vendedor"`)
  - Lista filtrada por `vendedor_atribuido_id = vendedor logado` (RLS já garante)
  - Histórico completo carregado normalmente (mensagens do agente + cliente + vendedor)
  - Vendedor envia mensagens com o mesmo fluxo Meta API que o gerente
  - **Sem botão** de encaminhar/devolver (apenas gerente/admin)
- Badge de novas atribuições no menu (poll 30s ou Realtime se já habilitado)
- `VendedorProtectedRoute` (já existe) protege a rota

## 6. Não muda

- Edge functions do agente IA (`agente-loja-cg`) — já respeitam `agente_pausado`
- `tools.ts`, `skill.ts`, `index.ts` do agente
- Endpoint Meta API de envio (`whatsapp-meta-send`) — vendedor reutiliza

## Detalhes técnicos

- Migration usa `IF NOT EXISTS` e idempotente
- RPCs com `SECURITY DEFINER` + `SET search_path = public`
- RLS de vendedor usa helper já existente `get_vendedor_id_by_email(get_auth_email())` (sem recursão)
- `types.ts` regenerado pós-migration
- Componente `WhatsAppChat` recebe prop opcional `scope: 'admin' | 'vendedor'` para esconder ações restritas

## Ordem de execução

1. Migration (colunas + RLS + RPCs)
2. Hook `useWhatsAppRole`
3. `WhatsAppPanel.tsx`: filtragem de tabs por papel
4. `WhatsAppChat.tsx`: tags + botão "Encaminhar" + filtros + prop `scope`
5. Modal `EncaminharVendedorDialog.tsx`
6. `VendedorWhatsApp.tsx` + rota em `App.tsx` + item no `VendedorLayout`
7. QA: superadmin (vê tudo) → gerente (só Conversas) → encaminha → vendedor recebe em `/vendedor/whatsapp`
