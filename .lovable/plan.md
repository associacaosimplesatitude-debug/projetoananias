

## Diagnóstico

Investiguei o código e o banco de dados. Eis o que encontrei:

1. **Dados atuais**: Lição 1 ("O Homem, Coroa da Criação") tem 5 imagens OK. Lição 2 tem 5 imagens. Lições 3-13 estão vazias (prontas para upload).

2. **Bug da "primeira imagem excluída"**: Encontrei o problema no `uploadPagesMutation`. Quando o upload é feito, o código lê as páginas existentes do cache do react-query (`licoes`). Se o cache estiver desatualizado (ex: após limpar páginas ou ao fazer uploads rápidos), o array `existing` pode estar errado, causando sobrescrita. Além disso, quando o upload usa `upsert: true` com o mesmo caminho (ex: `1.png`), pode sobrescrever arquivos anteriores.

3. **Visualização do aluno**: O código do `RevistaLeitor` e `RevistaLeituraContinua` exibe corretamente todas as imagens do array `paginas`. Se as imagens estão no banco, elas aparecem para o aluno.

## Correção

**Arquivo: `src/pages/admin/RevistasDigitais.tsx`**

Corrigir `uploadPagesMutation` para:
- Buscar `paginas` atuais **diretamente do banco** (não do cache react-query) antes de fazer o upload, evitando dados desatualizados
- Usar nomes de arquivo únicos baseados em timestamp (ex: `{Date.now()}-{i}.jpg`) em vez de números sequenciais, evitando sobrescrita acidental com `upsert`

```typescript
// Antes (bugado - lê do cache):
const existing = licoes?.find(l => l.id === licaoId)?.paginas || [];

// Depois (correto - lê do banco):
const { data: freshData } = await supabase
  .from("revista_licoes")
  .select("paginas")
  .eq("id", licaoId)
  .single();
const existing = (freshData?.paginas as string[]) || [];
```

E para os nomes de arquivo:
```typescript
// Antes (pode sobrescrever):
const path = `${managingLicoes!.id}/licao-${licaoNumero}/${ordem}.${ext}`;

// Depois (nome único):
const path = `${managingLicoes!.id}/licao-${licaoNumero}/${Date.now()}-${ordem}.${ext}`;
```

Mesma correção será aplicada ao `pdfToImagesMutation` que também tem o mesmo padrão.

| Arquivo | Mudança |
|---------|--------|
| `src/pages/admin/RevistasDigitais.tsx` | Buscar `paginas` do banco antes do upload; usar nomes únicos de arquivo |

