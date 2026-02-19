
# Tag do Vendedor nos Contatos + Modal "Visualizar Lead"

## 1. Tag do Vendedor na Lista de Contatos

Na lista lateral de contatos, abaixo do nome, sera exibida uma badge com o nome do vendedor atribuido ao lead (ex: "Elaine"), similar a imagem de referencia.

**Como funciona:**
- Ao carregar a lista de contatos, o sistema cruza o telefone do contato com a tabela `ebd_leads_reativacao` (campo `telefone`) e faz join com `vendedores` para obter o nome.
- Se o lead tiver `vendedor_id`, exibe uma Badge colorida com o nome do vendedor abaixo do nome do contato.
- Contatos sem lead ou sem vendedor nao exibem a tag.

## 2. Botao "Visualizar Lead" no Header do Chat

Na barra superior do chat (ao lado do nome do contato), sera adicionado um botao com icone de olho e tooltip "Visualizar lead". Ao clicar, abre um Dialog/Modal com informacoes completas do lead.

**Informacoes exibidas no modal:**
- **Nome** (nome_igreja ou nome_responsavel)
- **Telefone**
- **Vendedor** atribuido (nome do vendedor)
- **Tipo de cliente** (tipo_lead ou tipo_cliente: Igreja CNPJ, Igreja CPF, ADVEC, etc.)
- **Email**
- **CNPJ/CPF**
- **Dados de acesso ao painel Gestao EBD** (email, conta_criada, senha_temporaria do ebd_clientes se existir)
- **Ultimo pedido** (ultima proposta da tabela vendedor_propostas com status e data)
- **Ultimo login no painel Gestao EBD** (ultimo_login_ebd do lead ou ultimo_login do ebd_clientes)

Se o telefone nao corresponder a nenhum lead, o botao ficara desabilitado ou exibira mensagem "Lead nao encontrado".

---

## Detalhes Tecnicos

### Alteracoes em `src/components/admin/WhatsAppChat.tsx`

**1. Tipo Contact - adicionar campos:**
```text
vendedorNome?: string | null;
leadId?: string | null;
```

**2. Query de contatos - enriquecer com dados de leads:**
- Apos montar a lista de telefones, fazer query em `ebd_leads_reativacao` filtrando por telefone (`in`) com join em `vendedores(nome)`.
- Mapear o resultado para adicionar `vendedorNome` e `leadId` a cada contato.

**3. ContactList - renderizar badge do vendedor:**
- Abaixo do nome do contato, se `vendedorNome` existir, exibir `<Badge>` com o nome.

**4. ChatWindow header - botao "Visualizar Lead":**
- Adicionar botao com icone `Eye` ao lado do nome.
- Ao clicar, abre Dialog com dados do lead.

**5. Novo componente LeadDetailModal:**
- Recebe o telefone do contato.
- Faz queries em:
  - `ebd_leads_reativacao` (dados do lead, vendedor, tipo, score, ultimo_login_ebd)
  - `ebd_clientes` (dados de acesso: email, conta_criada, senha_temporaria, ultimo_login, tipo_cliente)
  - `vendedor_propostas` (ultimo pedido: status, valor_total, created_at) filtrando por `cliente_id`
- Exibe tudo organizado em secoes dentro do modal.

### Nenhuma migracao de banco necessaria
Todas as informacoes ja existem nas tabelas atuais. A vinculacao e feita pelo campo `telefone`.
