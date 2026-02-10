

# Agenda de Envio de Relatorios por Periodo de Pagamento

## Resumo

Duas alteracoes na pagina de Relatorios (/royalties/relatorios):

1. **Nova aba "Agenda de Envios"** com tabela mostrando autor, livro e data do proximo relatorio baseado no `periodo_pagamento` de cada livro
2. **Logica de calculo da data** baseada no periodo cadastrado (1_mes, 3_meses, 6_meses, 1_ano) contando a partir de 01/01/2026

## Logica de calculo das datas

Data base: **01/01/2026**

| Periodo | Datas de envio |
|---------|---------------|
| 1_mes | 31/01, 28/02, 31/03... (ultimo dia de cada mes) |
| 3_meses | 31/03, 30/06, 30/09, 31/12 |
| 6_meses | 30/06, 31/12 |
| 1_ano | 31/12 |

O sistema calcula o proximo envio futuro mais proximo a partir da data atual.

## Alteracoes

### 1. `src/pages/royalties/Relatorios.tsx`

- Adicionar nova aba "Agenda" nas tabs existentes (junto com Relatorios e Auditoria)
- Nova query para buscar livros ativos com autor e periodo de pagamento
- Funcao `calcularProximoEnvio(periodo_pagamento)` que:
  - Parte de 01/01/2026
  - Avanca pelo intervalo do periodo
  - Retorna a proxima data futura
- Tabela com colunas: Autor, Livro, Periodo, Proximo Envio
- Ordenar por data de proximo envio (mais proximo primeiro)

### Detalhes tecnicos

**Query necessaria:**
```
royalties_livros (id, titulo, is_active)
  -> royalties_autores (nome_completo)
  -> royalties_comissoes (periodo_pagamento)
```

**Funcao de calculo:**
- Data base fixa: 2026-01-01
- Para cada periodo, gerar sequencia de datas ate encontrar a proxima futura
- Exemplo: periodo 3_meses -> datas 31/03/2026, 30/06/2026, 30/09/2026...
- Retorna a primeira data >= hoje

**Arquivo alterado:** `src/pages/royalties/Relatorios.tsx` (adicionar aba + query + tabela)

