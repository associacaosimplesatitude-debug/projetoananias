

## Correção: erro "Invalid key" no upload de páginas

**Problema**: O upload de imagens de páginas usa o nome original do arquivo (`file.name`) como chave no storage. Nomes com espaços e caracteres especiais (como "35978_MIOLO_O líder acolhedor_Preflight_WEB_pages-to-jpg-0001.jpg") são rejeitados pelo Supabase Storage.

**Solução**: Sanitizar o nome do arquivo antes do upload, substituindo espaços e caracteres especiais por underscores, ou usar um nome sequencial simples.

## Arquivo alterado

`src/pages/admin/RevistasDigitais.tsx` (linha 369)

## Mudança

Trocar:
```typescript
const path = `${revistaId}/paginas/${file.name}`;
```

Por:
```typescript
const safeName = file.name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_');
const path = `${revistaId}/paginas/${safeName}`;
```

Isso remove acentos e substitui espaços e caracteres especiais por `_`, garantindo que a chave seja sempre válida no storage.

