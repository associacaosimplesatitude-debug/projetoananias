

## Plano: Reutilizar público salvo de campanhas existentes

### Problema
O público já está salvo na tabela `whatsapp_campanha_destinatarios`, mas ao criar uma nova campanha, o usuário é obrigado a buscar novamente no Bling. Não há opção de reaproveitar o público de uma campanha anterior.

### Solução
Adicionar um botão "Usar público de campanha existente" na etapa de segmentação que permite selecionar uma campanha anterior e carregar seus destinatários diretamente do banco.

### Alteração no arquivo `src/components/admin/WhatsAppCampaigns.tsx`

1. **Na etapa "segmentation"**, adicionar uma seção acima dos filtros de busca com:
   - Um `Select` listando campanhas existentes que possuam destinatários (`total_publico > 0`)
   - Um botão "Carregar Público" que busca os destinatários da campanha selecionada via `whatsapp_campanha_destinatarios`
   - Ao carregar, popula o state `recipients` com os dados, permitindo seguir para a etapa de template normalmente

2. **Lógica de carregamento**:
   - Query: `SELECT * FROM whatsapp_campanha_destinatarios WHERE campanha_id = X`
   - Mapear os campos para o formato `Recipient` já existente
   - Exibir toast com quantidade carregada

3. **UI**: Separar visualmente com um divisor "OU" entre "Usar público existente" e "Buscar novo público no Bling"

### Resumo
- Apenas 1 arquivo alterado: `WhatsAppCampaigns.tsx`
- Sem migração de banco necessária (dados já estão salvos)
- O público carregado segue o mesmo fluxo de criação de campanha

