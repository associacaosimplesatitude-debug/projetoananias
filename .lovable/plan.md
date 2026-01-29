

# Plano: Fases 9, 10 e 11 - Auditoria, Refinamentos e Integrações Finais

## Resumo

Vamos implementar as três fases finais do Sistema de Royalties:
- **Fase 9:** Sistema de auditoria com triggers automáticos
- **Fase 10:** Página de detalhes do autor e validadores de CPF/CNPJ
- **Fase 11:** Integração do link "Royalties" no menu principal

---

## Fase 9: Sistema de Auditoria

### 9.1 Triggers de Auditoria (Database)

Criar triggers que registrem automaticamente todas as operações (INSERT, UPDATE, DELETE) nas tabelas do módulo Royalties.

**Função de auditoria:**
```text
CREATE FUNCTION royalties_audit_trigger()
  ├── Captura user_id do auth.uid()
  ├── Captura ação (INSERT, UPDATE, DELETE)
  ├── Armazena dados_antigos (OLD) e dados_novos (NEW)
  └── Insere em royalties_audit_logs
```

**Triggers a criar:**
| Tabela | Eventos |
|--------|---------|
| `royalties_autores` | INSERT, UPDATE, DELETE |
| `royalties_livros` | INSERT, UPDATE, DELETE |
| `royalties_comissoes` | INSERT, UPDATE, DELETE |
| `royalties_vendas` | INSERT, UPDATE, DELETE |
| `royalties_pagamentos` | INSERT, UPDATE, DELETE |

### 9.2 Visualização de Logs (Frontend)

Adicionar uma seção na página de Relatórios para visualizar o histórico de auditoria:
- Filtros por tabela, ação e período
- Tabela mostrando: Data, Usuário, Ação, Tabela, Registro

---

## Fase 10: Refinamentos

### 10.1 Página de Detalhes do Autor

Criar `/royalties/autores/:id` com:

```text
┌─────────────────────────────────────────────────────────┐
│ João Silva                                    [Editar]  │
│ joao@email.com | CPF: 123.456.789-00                   │
├─────────────────────────────────────────────────────────┤
│ RESUMO FINANCEIRO                                       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ Total   │ │ Já Pago │ │ Pendente│ │ Livros  │        │
│ │R$ 5.000 │ │R$ 3.000 │ │R$ 2.000 │ │   3     │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│ LIVROS DO AUTOR                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Capa │ Título      │ Comissão │ Vendas │ Acumulado ││
│ │ [📕] │ Livro A     │ 10%      │ 150    │ R$ 1.500  ││
│ │ [📗] │ Livro B     │ 8%       │ 200    │ R$ 2.000  ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ HISTÓRICO DE PAGAMENTOS                                 │
│ Data       │ Valor    │ Status │ Comprovante           │
│ 15/01/2026 │ R$ 1.500 │ Pago   │ [Download]            │
│ 15/12/2025 │ R$ 1.500 │ Pago   │ [Download]            │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Validadores de CPF/CNPJ

Criar `src/lib/royaltiesValidators.ts`:
- `validateCPF(cpf: string): boolean`
- `validateCNPJ(cnpj: string): boolean`
- `formatCPFCNPJ(value: string): string`
- `validateCPFOrCNPJ(value: string): boolean`

Integrar validação no `AutorDialog.tsx` com feedback visual.

### 10.3 Rota no App.tsx

Adicionar a rota para detalhes do autor:
```text
/royalties/autores/:id → AutorDetalhes.tsx
```

---

## Fase 11: Integrações Finais

### 11.1 Menu AdminLayout

Adicionar link "Royalties" no sidebar do AdminLayout:

```text
Configurações
├── Personalização
├── Tutoriais
└── Royalties ← NOVO (ícone: BookOpenText)
```

### 11.2 Link na Tabela de Autores

Tornar o nome do autor clicável, levando à página de detalhes.

---

## Arquivos a Criar/Modificar

### Novos Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/royalties/AutorDetalhes.tsx` | Página de detalhes do autor |
| `src/lib/royaltiesValidators.ts` | Validadores de CPF/CNPJ |

### Arquivos a Modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/royalties/autores/:id` |
| `src/components/admin/AdminLayout.tsx` | Adicionar link "Royalties" |
| `src/pages/royalties/Autores.tsx` | Nome do autor como link |
| `src/components/royalties/AutorDialog.tsx` | Validação de CPF/CNPJ |
| `src/pages/royalties/Relatorios.tsx` | Seção de logs de auditoria |

---

## Migração de Banco de Dados

### Função de Auditoria
```sql
CREATE OR REPLACE FUNCTION public.royalties_audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.royalties_audit_logs 
      (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES 
      (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.royalties_audit_logs 
      (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES 
      (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.royalties_audit_logs 
      (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES 
      (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Triggers (5 tabelas)
```sql
CREATE TRIGGER audit_royalties_autores
  AFTER INSERT OR UPDATE OR DELETE ON royalties_autores
  FOR EACH ROW EXECUTE FUNCTION royalties_audit_trigger_fn();

-- Repetir para: livros, comissoes, vendas, pagamentos
```

---

## Sequência de Implementação

1. **Database:** Criar função e triggers de auditoria
2. **Validadores:** Criar `royaltiesValidators.ts`
3. **AutorDetalhes:** Criar página com resumo financeiro
4. **Rotas:** Atualizar App.tsx com nova rota
5. **Menu Admin:** Adicionar link "Royalties" 
6. **Autores:** Tornar nome clicável
7. **AutorDialog:** Integrar validação CPF/CNPJ
8. **Relatórios:** Adicionar visualização de logs

---

## Seção Técnica

### Validação de CPF
```text
Algoritmo:
1. Remove formatação (pontos, traços)
2. Verifica se tem 11 dígitos
3. Rejeita sequências iguais (111.111.111-11)
4. Calcula primeiro dígito verificador
5. Calcula segundo dígito verificador
6. Compara com os dígitos informados
```

### Validação de CNPJ
```text
Algoritmo:
1. Remove formatação
2. Verifica se tem 14 dígitos
3. Rejeita sequências iguais
4. Calcula primeiro dígito verificador (multiplicadores: 5,4,3,2,9,8,7,6,5,4,3,2)
5. Calcula segundo dígito verificador (multiplicadores: 6,5,4,3,2,9,8,7,6,5,4,3,2)
6. Compara com os dígitos informados
```

### Estrutura do Log de Auditoria
```text
royalties_audit_logs:
├── id (UUID)
├── user_id (UUID) → Quem executou
├── acao (TEXT) → INSERT, UPDATE, DELETE
├── tabela (TEXT) → Nome da tabela afetada
├── registro_id (UUID) → ID do registro afetado
├── dados_antigos (JSONB) → Estado anterior
├── dados_novos (JSONB) → Estado atual
└── created_at (TIMESTAMP)
```

