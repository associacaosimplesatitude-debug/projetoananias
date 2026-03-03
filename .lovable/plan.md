

## Plano: Adicionar seleção Texto/Mídia ao criador de templates

### Alterações

**1. Migração — adicionar coluna `cabecalho_midia_url`**
```sql
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS cabecalho_midia_url text;
```

**2. Editar `WhatsAppTemplateCreator.tsx`**
- Adicionar campo **"Tipo do Cabeçalho"** (Select: Nenhum / Texto / Imagem) entre Categoria e Variáveis
- Se **Texto**: mostrar input para texto do cabeçalho
- Se **Imagem**: mostrar área de upload com:
  - Input file aceita `image/jpeg, image/png`
  - Upload para Supabase Storage (bucket `whatsapp-media`)
  - Informativo com limites do Meta:
    - **Imagem**: JPEG ou PNG, máx. **5 MB**, recomendado 800×800px
  - Preview da imagem selecionada
  - Salvar URL no campo `cabecalho_midia_url`
- No **Preview** WhatsApp: exibir a imagem acima do texto do corpo quando tipo = Imagem
- Incluir `cabecalho_tipo`, `cabecalho_texto`, `cabecalho_midia_url` no payload de save/submit

**3. Migração — criar bucket `whatsapp-media`**
Storage bucket para as imagens de cabeçalho dos templates.

**4. Editar `whatsapp-submit-template` (Edge Function)**
- Quando `cabecalho_tipo = 'IMAGE'`, incluir componente `HEADER` com formato `IMAGE` e `example.header_handle` no payload enviado ao Meta.

