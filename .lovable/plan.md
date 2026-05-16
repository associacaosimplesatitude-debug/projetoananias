## Correção da Multi-Licença — Jonathan Gonzalez

### Diagnóstico

Encontrei a licença Multi (40 unidades, origem `nova_loja_cg`) do cliente **Jonathan Gonzalez** (`jonathanbaldancaca@gmail.com`):

- **Licença ID:** `3c737ea9-6460-422d-8003-34e8e76801a7`
- **Quantidade:** 40 (1 já distribuída para a aluna Rebeca Gonzalez, status `pendente`)
- **Revista atual (errada):** Revista EBD Adolescente 05 - Amando a Deus e ao Próximo - 15 A 17 ALUNO
- **Revista correta:** Revista EBD Jovens e Adultos Nº9 - Cartas da Prisão - ALUNO (`87f217f3-093a-459b-87ab-4bb7c6a7951a`)

### Mudança

Atualizar `revista_licencas.revista_aluno_id` da licença acima para o ID da revista "Cartas da Prisão - ALUNO".

A aluna já distribuída (Rebeca Gonzalez) automaticamente passa a ter acesso à revista correta, pois o vínculo é feito via `licenca_id` → `revista_aluno_id`. Nenhum outro registro precisa ser ajustado.

```sql
UPDATE revista_licencas
SET revista_aluno_id = '87f217f3-093a-459b-87ab-4bb7c6a7951a',
    updated_at = now()
WHERE id = '3c737ea9-6460-422d-8003-34e8e76801a7';
```

Sem alterações de código ou schema — apenas correção pontual de dado.