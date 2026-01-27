# Plano: Corrigir Geração de NF-e para Loja Penha (PDV) ✅

## Status: IMPLEMENTADO

### Código Atualizado ✅
Adicionado retry com delay para erro 429 (Rate Limit) na função `getLastNfeNumber`:
- Até 3 tentativas por página com erro 429
- Delay de 2 segundos entre tentativas
- Logs detalhados de cada retry

### Pendência: Configuração no Bling ⚠️
O Bling está ignorando o campo `serie` do payload porque a **Natureza de Operação** tem uma série padrão configurada.

**Ação necessária:**
1. Acessar o Bling → Cadastros → Naturezas de Operação
2. Editar "PENHA - Venda de mercadoria - PF" (ID: 15108893128)
3. Configurar **Série padrão = 15**
4. Salvar

Sem essa configuração no Bling, as NF-es da Penha continuarão usando série 1 ao invés de série 15.
