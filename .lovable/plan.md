

# Deletar registros de teste do painel do Antonio

## Registros identificados

Todos os 7 registros estao na tabela `vendas_balcao`, vinculados ao vendedor **Antonio**:

| NF-e   | Cliente                                      | Valor    |
|--------|----------------------------------------------|----------|
| 019280 | ADVEC JACUI                                  | R$ 8,39  |
| 019279 | MARIA ELIANE GIMENEZ FLORES                  | R$ 8,39  |
| 019278 | ADVEC PIABETA 2                              | R$ 8,39  |
| 019277 | SANDRO ROGERIO DE ABREU                      | R$ 5,00  |
| 019276 | ELENITA DA SILVA PEREIRA                     | R$ 9,00  |
| 019275 | IGREJA METODISTA EM HONORIO GURGEL           | R$ 27,67 |
| 019274 | IGREJA CRISTA PROJETO FAMILIA EM CRISTO...   | R$ 7,00  |

## Acao

Executar um DELETE na tabela `vendas_balcao` para remover esses 7 registros usando seus IDs.

## Detalhes tecnicos

```text
DELETE FROM vendas_balcao
WHERE id IN (
  '850c258d-...', -- 019280 ADVEC JACUI
  '08a13436-...', -- 019279 MARIA ELIANE
  '92645e8e-...', -- 019278 ADVEC PIABETA 2
  'a1eade0c-...', -- 019277 SANDRO ROGERIO
  '3895a8aa-...', -- 019276 ELENITA
  '8230a010-...', -- 019275 IGREJA METODISTA
  'ff1d40e0-...'  -- 019274 IGREJA CRISTA
);
```

Nao ha tabelas dependentes (sem itens ou registros filhos vinculados).

