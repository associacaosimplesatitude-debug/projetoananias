## Objetivo

Rastrear automaticamente toda ação que um vendedor faz sobre uma proposta (criou, editou, marcou como PAGO, regerou, cancelou etc.), gravando quem clicou, quando, e o que mudou — sem depender de cada botão lembrar de chamar um log.

## Estratégia

Trigger no banco sobre `vendedor_propostas`. Toda mudança fica registrada, venha do app do vendedor, do admin, ou de uma edge function. A tabela `vendedor_propostas_audit` já existe.

### 1. Trigger automático (cobre 100% das ações)
`AFTER INSERT/UPDATE/DELETE` em `vendedor_propostas` → grava em `vendedor_propostas_audit`:
- `CREATE` / `MARCAR_PAGO` / `CANCELAR` / `STATUS_CHANGE:X->Y` / `EDIT_VALOR` / `EDIT_PRAZO_FATURAMENTO` / `BLING_LINK` / `UPDATE` / `DELETE`.
- `user_id = auth.uid()` (NULL = edge function/automático).
- Diff apenas dos campos mudados (`old_data`/`new_data`), ignora updates só de `updated_at`.

### 2. Detecção de duplicatas (caso Neila)
Trigger `AFTER INSERT` que detecta mesmo CNPJ + mesmo valor em janela de 10 min e grava linha `DUPLICATA_SUSPEITA` no audit (não bloqueia).

### 3. Página de visualização — APENAS SUPERADMIN
Nova rota `/admin/ebd/auditoria-vendedor` (`src/pages/admin/AuditoriaVendedor.tsx`), protegida por `RequireSuperadmin`:
- Filtros: vendedor, ação, busca por cliente/CNPJ/proposta.
- Lista: data/hora, vendedor (nome via join com `vendedores.user_id`), ação (badge colorida), link pra proposta, diff antes/depois.
- Destaque vermelho para `DUPLICATA_SUSPEITA` e `MARCAR_PAGO` sem `prazo_faturamento_selecionado`.
- Item no menu do `AdminEBDLayout` visível só para superadmin.
- RLS: policy `SELECT` na tabela audit restrita a `has_role('superadmin')`.

## Resultado
Toda ação de qualquer vendedor sobre qualquer proposta fica registrada com quem + quando + o que mudou. No caso Neila/Igreja Batista Mantena, apareceriam: 4 INSERTs em 10 min com flag `DUPLICATA_SUSPEITA`, 3 `MARCAR_PAGO` sem prazo de faturamento, todos com `user_id` dela.
