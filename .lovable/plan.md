## Objetivo
Expandir o seletor de país em `src/pages/revista/RevistaAcesso.tsx` para listar **todos os países** com bandeira + nome + DDI, em vez de apenas BR / PT / US. Nada mais muda — formatação, layout, validação, lógica de envio e identificador WhatsApp permanecem iguais.

## Mudanças

### Único arquivo editado
`src/pages/revista/RevistaAcesso.tsx`

### O que muda
1. Substituir o array `COUNTRIES` (hoje com 3 entradas) por uma lista completa (~240 países), cada item com:
   - `code` (ISO-2, ex: "BR", "AR", "DE")
   - `flag` (emoji da bandeira)
   - `ddi` (código telefônico, ex: "55", "54", "49")
   - `label` (nome em português, ex: "Brasil", "Argentina", "Alemanha")
   - `maxDigits` / `minDigits` — para países sem regra específica, usar valores genéricos permissivos (`minDigits: 6`, `maxDigits: 15`, conforme padrão E.164).
   - `placeholder` — usar um genérico tipo `"Número de telefone"` para os países novos. BR / PT / US mantêm os placeholders e regras de dígitos atuais.

2. Adicionar **busca** dentro do dropdown (input no topo) — com 240 países uma lista rolável sem busca fica inviável. Filtra por nome ou DDI.

3. Aumentar a altura máxima do dropdown (`max-h-80 overflow-y-auto`) e ajustar largura (`w-72`) para caber nome + DDI confortavelmente.

4. Manter `BR` como país padrão (`COUNTRIES[0]` continua sendo Brasil).

### O que NÃO muda
- Formatação de telefone: `formatPhoneBR` / `formatPhonePT` / `formatPhoneUS` continuam exatamente iguais. Para os demais países, `formatPhone` cai no `formatPhoneBR` — para evitar máscara errada, ajusto `formatPhone` para retornar apenas dígitos crus (sem máscara) quando o país não for BR/PT/US.
- `buildWhatsappIdentifier` continua: BR sem DDI no início, demais países com DDI prefixado.
- Lógica de validação (`isInputValid`), envio OTP, sessão, layout do card, estilo dos botões — tudo intacto.
- Nenhum outro arquivo é tocado.

## Detalhes técnicos
- A lista de países será inline no arquivo (constante exportada local). Fonte: lista padrão ISO-3166 + códigos E.164. Aproximadamente 240 entradas.
- Bandeiras via emoji Unicode (não precisa imagem externa, já é o padrão atual da página).
- Busca: estado local `countrySearch`, filtra `COUNTRIES` por `label.toLowerCase().includes(query)` ou `ddi.includes(query)`. Reset ao fechar dropdown.
- Acessibilidade: input de busca com `autoFocus` quando dropdown abre.

## Fora de escopo
- Não mexer em `DistribuirLicencaDialog` nem em outras telas.
- Não criar máscaras específicas para os ~237 países novos (entrada livre de dígitos basta).
- Não alterar Edge Functions, schema ou `revistaSession`.
