
# Análise: Numeração de NF-e para Loja Penha (PDV)

## Diagnóstico Completo

### Dados Analisados
Analisei as NF-es emitidas pela Loja Penha nos últimos dias:

| Data | Número | CNPJ na Chave | Série | Polo |
|------|--------|---------------|-------|------|
| 27/01/2026 | 030550 | 03.147.650/0003-14 | 001 | Penha |
| 26/01/2026 | 030263 | 03.147.650/0003-14 | 001 | Penha |
| 26/01/2026 | 030261 | 03.147.650/0003-14 | 001 | Penha |
| 23/01/2026 | 030259 | 03.147.650/0003-14 | 001 | Penha |
| 23/01/2026 | 030257 | 03.147.650/0003-14 | 001 | Penha |
| 22/01/2026 | 030255 | 03.147.650/0003-14 | 001 | Penha |
| 22/01/2026 | 030253 | 03.147.650/0003-14 | 001 | Penha |
| 22/01/2026 | 030251 | 03.147.650/0003-14 | 001 | Penha |

### Conclusão da Análise

**O sistema está funcionando corretamente!**

As NF-es da Loja Penha estão sendo emitidas com:
- **CNPJ correto**: 03.147.650/0003-14 (filial Penha)
- **Série correta**: 001 (Série 1)
- **Numeração sequencial**: 030247 → 030249 → 030251 → ... → 030550

A sequência **030xxx com Série 1 é a sequência correta para a Penha** conforme o histórico de NF-es emitidas.

---

## Sobre a Sequência 019xxx

O screenshot que mostrava "Próximo: 019142" pode ser de:
1. **Outra série** configurada no Bling (ex: Série 15 ou outra)
2. **Outra empresa/CNPJ** no Bling
3. **Outro canal de vendas** (não o PDV da Penha)

### Comparativo de Configurações no Bling

| Empresa | CNPJ | Série | Faixa de Números |
|---------|------|-------|------------------|
| Penha (PDV) | 03.147.650/0003-14 | 1 | 030xxx ✓ |
| Matriz RJ | 03.147.650/0001-52 | 15 | 030xxx |

---

## Próximos Passos

Para confirmar que tudo está correto, você pode verificar no Bling:

1. **Acessar Bling → Notas Fiscais**
2. **Filtrar por Série 1 e Empresa Penha (CNPJ 0003-14)**
3. **Confirmar que a última nota é 030550 ou superior**

Se a expectativa é usar a faixa 019xxx para a Penha, será necessário:
- Identificar qual canal/série está configurado para 019xxx no Bling
- Ajustar o código para usar essa série específica

**Por favor, confirme qual sequência (030xxx ou 019xxx) a Loja Penha DEVERIA usar**, e qual é a configuração atual dessa série no Bling.
