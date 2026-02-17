

# Criar Registro de Teste no Banco para Validar Fluxo WhatsApp

## O que sera feito
Inserir **um unico registro** na tabela `ebd_clientes` com o telefone `5511964103366` para que o webhook existente encontre o cliente ao receber a resposta "SIM".

**Nenhuma logica sera alterada.** O codigo do webhook ja funciona corretamente -- ele busca pelo campo `telefone` na tabela `ebd_clientes`. O problema atual e apenas a ausencia de um registro com esse numero.

## Tambem: Melhorar o template da primeira mensagem
A primeira mensagem de teste enviada manualmente estava muito simples. Ao reenviar o teste, usaremos o template completo com:
- Numero do pedido
- Itens detalhados com quantidades e precos
- Frete
- Total e confirmacao de pagamento
- Secao "Voce sabia?" com funcionalidades do sistema
- Call-to-action para responder SIM

## Secao Tecnica

### Passo 1: Inserir registro de teste via SQL
Executar um INSERT na tabela `ebd_clientes` com os campos minimos que o webhook precisa:

```sql
INSERT INTO ebd_clientes (
  telefone,
  nome_igreja,
  email_superintendente,
  senha_temporaria,
  status_ativacao_ebd,
  is_pos_venda_ecommerce
) VALUES (
  '5511964103366',
  'Igreja Teste WhatsApp',
  'teste.whatsapp@gestaoebd.com',
  'mudar123',
  true,
  true
);
```

### Passo 2: Reenviar mensagem de teste completa
Enviar a mensagem via `send-whatsapp-message` usando o template rico (com itens, precos, frete, funcionalidades do sistema).

### Passo 3: Aguardar resposta "SIM" e validar
O webhook vai receber a resposta, encontrar o registro pelo telefone, e a IA vai chamar `enviar_credenciais` que retornara o email `teste.whatsapp@gestaoebd.com` e a senha `mudar123`.

### Arquivos alterados
Nenhum arquivo de codigo sera alterado. Apenas um INSERT no banco de dados.
