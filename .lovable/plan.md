

# Dashboard de Metricas de Emails com Graficos

## Resumo

Adicionar uma nova aba "Metricas" na pagina Emails EBD (`/admin/ebd/emails-ebd`) com graficos de volume de envios por dia e por semana, alem de taxas de abertura e clique ao longo do tempo.

## Alteracoes

### 1. Nova aba "Metricas" no componente VendedorEmailsEBD.tsx

Adicionar uma 4a aba chamada "Metricas" (com icone BarChart3) ao TabsList existente, ao lado de "Disparar Email", "Historico" e "Automaticos".

### 2. Query de dados para os graficos

Buscar os logs dos ultimos 30 dias agrupados por dia, calculando:
- Total de envios por dia
- Total de aberturas por dia
- Total de cliques por dia

A query vai buscar todos os `ebd_email_logs` dos ultimos 30 dias e agrupar no frontend por data (usando `format(created_at, 'dd/MM')`).

### 3. Graficos usando Recharts (ja instalado)

Dois graficos principais:

**Grafico 1 -- Envios por dia (ultimos 30 dias)**
- Grafico de barras (BarChart) com eixo X = dia, eixo Y = quantidade
- Barras empilhadas: abertos (verde), nao abertos (cinza)

**Grafico 2 -- Taxa de abertura e clique por semana**
- Grafico de linhas (LineChart) com 2 linhas
- Linha 1: taxa de abertura (%)
- Linha 2: taxa de clique (%)
- Eixo X = semana (ex: "Sem 1", "Sem 2"...)

### 4. Cards resumo no topo da aba

Quatro cards compactos no topo da aba Metricas:
- Total de emails (30 dias)
- Taxa de abertura geral (%)
- Taxa de clique geral (%)
- Media de envios/dia

### 5. Detalhes tecnicos

- Usar os componentes `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` ja existentes em `src/components/ui/chart.tsx`
- Usar `Card`, `CardHeader`, `CardTitle`, `CardContent` existentes
- O `TabsList` passa de 4 itens (grid-cols-4 em mobile se necessario)
- A aba so aparece quando `isAdminView = true` (apenas admin ve metricas)
- Responsividade: graficos em stack vertical no mobile, lado a lado no desktop

