# Corrigir tag "Novo contato" no /admin/whatsapp

## Problema

A montagem da tag em `src/components/admin/WhatsAppChat.tsx` (linhas ~777-853) só considera vínculo cliente↔vendedor quando `agente_ia_conversas.cliente_id` está preenchido. Como muitas conversas vindas do webhook WhatsApp nunca têm esse `cliente_id` gravado, telefones de clientes antigos (inclusive de campanhas de retenção) caem no `else` final e aparecem como **"Novo contato"**, sem vendedor.

Exemplo verificado: `11981147165` → cliente "IGREJA EVANGELICA FILHOS DO REI" em `ebd_clientes`, vendedor `Daniel` (`5e04d9c1-…`). A tag deveria mostrar **"Vendedor: Daniel"**.

## Solução

Adicionar uma 3ª fonte de fallback (além de `agente_ia_conversas` e `ebd_leads_reativacao`): consulta direta a `ebd_clientes` por todas as variantes de telefone.

### Mudanças (somente frontend, em `src/components/admin/WhatsAppChat.tsx`)

1. Após o bloco que monta `leadVendedorByVariant` (linha ~822), adicionar uma nova consulta:
   ```ts
   const { data: clientesByPhone } = await supabase
     .from("ebd_clientes")
     .select("id, nome_igreja, telefone, vendedor_id, vendedores(id, nome), updated_at")
     .not("telefone", "is", null)
     .not("vendedor_id", "is", null)
     .in("telefone", allVariants)
     .order("updated_at", { ascending: false });
   ```

2. Construir um índice por variante normalizada (mais recente vence; se múltiplos clientes no mesmo telefone, mantém o primeiro = mais recente):
   ```ts
   const clienteByVariant: Record<string, { clienteId: string; vendedorId: string; vendedorNome: string }> = {};
   ```

3. No loop `phones.map(...)` (linha ~831), procurar nesse índice quando `atrib?.clienteId` estiver vazio:
   ```ts
   const fallbackCliente = variants.reduce<…>((acc, v) => acc || clienteByVariant[v] || null, null);
   ```

4. Atualizar a regra da tag (linhas 844-853):
   - `vendedorAtribuidoId` → `atendendo` (sem mudança)
   - `atrib?.clienteId && vendedorHistoricoNome` → `vendedor_historico` (sem mudança)
   - **Novo:** `fallbackCliente` (telefone bate em `ebd_clientes` com vendedor) → `vendedor_historico` com `vendedorNome = fallbackCliente.vendedorNome`
   - `atrib?.clienteId` → `sem_vendedor`
   - **Novo:** telefone existe em `ebd_clientes` sem vendedor → `sem_vendedor`
   - resto → `novo_contato`

5. Preencher também `clienteId`, `vendedorHistoricoId`, `vendedorHistoricoNome` no `Contact` quando vier do fallback de `ebd_clientes`, para que o botão "Encaminhar para vendedor" e o `LeadDetailModal` continuem funcionando corretamente.

### Performance

`allVariants` já é usado na consulta a `agente_ia_conversas`. A nova consulta usa o mesmo array com `.in()`, então é uma única query extra por carga da lista. Sem N+1.

### Sem mudanças em

- Banco de dados / migrations
- Edge functions
- Lógica de envio, encaminhamento, RPCs
- Página `/vendedor/whatsapp` (continua filtrando por `vendedorAtribuidoId`)

## Resultado esperado

O telefone `11981147165` (e os outros marcados como "Novo contato" que já têm cadastro em `ebd_clientes`) passa a exibir o badge verde **"Vendedor: {nome}"** automaticamente, sem que o gerente precise encaminhar.
