
# Plano: Menu de Administracao de Apresentacao no Painel Admin Geral

## Objetivo
Criar uma pagina administrativa no painel Admin Geral onde voce podera fazer upload de screenshots para cada card da pagina de apresentacao, salvando as imagens no banco de dados (URLs) para carregamento dinamico.

---

## Arquitetura

### Banco de Dados
Criar tabela `apresentacao_screenshots` para armazenar as URLs das imagens:

```text
+-----------------------------+
| apresentacao_screenshots    |
+-----------------------------+
| id (uuid, PK)               |
| section (text)              |  -> "superintendente", "vendedor", "admin"
| feature_key (text)          |  -> identificador unico do card
| screenshot_url (text)       |  -> URL da imagem no storage
| created_at (timestamp)      |
| updated_at (timestamp)      |
+-----------------------------+
```

### Storage
Criar bucket `apresentacao-screenshots` para armazenar as imagens uploadadas.

---

## Implementacao

### Passo 1: Criar Bucket de Storage
- Criar bucket `apresentacao-screenshots` com acesso publico para leitura

### Passo 2: Criar Tabela no Banco
- Criar tabela `apresentacao_screenshots`
- Criar RLS policies para admin poder gerenciar
- Criar policy de leitura publica para a pagina de apresentacao

### Passo 3: Criar Pagina de Admin
Criar `src/pages/admin/ApresentacaoScreenshots.tsx`:
- Interface com 3 abas: Superintendente, Vendedor, Admin
- Lista de cards com preview da imagem atual ou placeholder
- Botao de upload em cada card
- Funcao de remover imagem
- Salvamento automatico no banco

### Passo 4: Adicionar Menu no AdminLayout
Adicionar link "Apresentacao" na secao "Configuracoes" do sidebar em `AdminLayout.tsx`

### Passo 5: Adicionar Rota
Adicionar rota `/admin/apresentacao` no `App.tsx`

### Passo 6: Atualizar Pagina de Apresentacao
Modificar `Apresentacao.tsx` para:
- Buscar screenshots do banco de dados via query
- Usar URL do banco quando disponivel
- Fallback para placeholder quando nao houver imagem

---

## Fluxo de Uso

```text
1. Admin acessa /admin/apresentacao
2. Seleciona aba (Superintendente/Vendedor/Admin)
3. Clica no botao de upload no card desejado
4. Seleciona imagem do computador
5. Imagem e enviada para o storage
6. URL e salva na tabela apresentacao_screenshots
7. Pagina /apresentacao carrega automaticamente a nova imagem
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabela e bucket |
| `src/pages/admin/ApresentacaoScreenshots.tsx` | Criar pagina de admin |
| `src/components/admin/AdminLayout.tsx` | Adicionar menu |
| `src/App.tsx` | Adicionar rota |
| `src/pages/Apresentacao.tsx` | Buscar imagens do banco |

---

## Detalhes Tecnicos

### Hook de Upload
```typescript
// Upload para storage
const uploadScreenshot = async (file: File, section: string, featureKey: string) => {
  const filePath = `${section}/${featureKey}-${Date.now()}.${file.name.split('.').pop()}`;
  const { data, error } = await supabase.storage
    .from('apresentacao-screenshots')
    .upload(filePath, file, { upsert: true });
  
  // Salvar URL na tabela
  const publicUrl = supabase.storage.from('apresentacao-screenshots').getPublicUrl(filePath);
  await supabase.from('apresentacao_screenshots')
    .upsert({ section, feature_key: featureKey, screenshot_url: publicUrl.data.publicUrl });
};
```

### Query na Apresentacao
```typescript
const { data: screenshots } = useQuery({
  queryKey: ['apresentacao-screenshots'],
  queryFn: async () => {
    const { data } = await supabase.from('apresentacao_screenshots').select('*');
    return data;
  }
});
```

---

## Resultado Esperado
- Menu "Apresentacao" disponivel no Admin Geral
- Interface visual para upload de screenshots por card
- Imagens salvas no storage e referenciadas no banco
- Pagina de apresentacao carregando imagens dinamicamente
- Sem necessidade de mexer no codigo para atualizar screenshots

