

## Plano: Separar endereço de cobrança e entrega no Bling

### Descobertas

**Chaves atuais do payload** (linhas 1164-1175):
```
endereco.geral.endereco  (rua)
endereco.geral.numero
endereco.geral.complemento
endereco.geral.bairro
endereco.geral.cep
endereco.geral.municipio
endereco.geral.uf
endereco.geral.pais
```
Vou manter **exatamente** esses nomes de chave — apenas trocar a fonte de `endereco_entrega` para `clienteDb.endereco_*`.

**CNPJs com endereço incompleto:** Apenas **2 de 354** — ambos faltam só `estado` ou `cidade`:
- IGREJA MIN. CRISTO AS NAÇÕES (falta estado)
- MISSAO SOCORRISTA EVANGELICA (falta cidade e estado)

### Alterações no arquivo `supabase/functions/bling-create-order/index.ts`

**1. SELECT do ebd_clientes (linha 1104)**
Adicionar: `endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cep, endereco_cidade, endereco_estado`

**2. Validação com fase de transição (após linha 1117)**
Para CNPJ sem endereço completo: **não bloquear agora** — apenas logar warning `[ENDERECO_WARN] Cliente CNPJ sem endereço principal completo` e usar `endereco_entrega` como fallback temporário. Isso evita travar faturamento dos 2 clientes incompletos. Após correrem os cadastros, ativamos o bloqueio 400.

**3. Construir billingAddress e shippingAddress independentes (~linha 1150)**
```text
billingAddress = {
  endereco: clienteDb.endereco_rua,
  numero: clienteDb.endereco_numero || 'S/N',
  complemento: clienteDb.endereco_complemento || '',
  bairro: clienteDb.endereco_bairro || '',
  cep: clienteDb.endereco_cep (limpo),
  municipio: clienteDb.endereco_cidade,
  uf: clienteDb.endereco_estado,
  pais: 'Brasil'
}

shippingAddress = {
  endereco: endereco_entrega.rua,
  numero: endereco_entrega.numero || 'S/N',
  complemento: endereco_entrega.complemento || '',
  bairro: endereco_entrega.bairro || '',
  cep: endereco_entrega.cep (limpo),
  municipio: endereco_entrega.cidade,
  uf: endereco_entrega.estado,
  pais: 'Brasil'
}
```

**4. Substituir linhas 1164-1175**
Usar `billingAddress` em `contatoPayloadCompleto.endereco.geral` (se disponível, senão fallback para `shippingAddress` + warning).

**5. Assert de integridade (após montagem)**
Se `billingAddress.cep !== shippingAddress.cep`, verificar que o payload final usa os CEPs corretos. Se detectar sobrescrita: `throw new Error("BUG_ENDERECO: CEP do contato sobrescrito pelo CEP de entrega")`.

Log: `[ENDERECO_AUDIT] billing_cep=XXXXX shipping_cep=YYYYY separados=true|false`

**6. `transporte.etiqueta`** (linhas 2481-2495) — já usa `endereco_entrega`, não alterar.

### Os 2 clientes incompletos
Os IDs serão informados no log para correção manual:
- `db4f41aa` — falta estado
- `59beee22` — falta cidade e estado

