
# Plano: Adicionar Screenshots na Aba Superintendente

## Objetivo
Substituir os 12 placeholders da aba "Superintendente" pelas imagens reais enviadas pelo usuario.

## Mapeamento das Imagens

| Imagem | Funcionalidade | Nome do Arquivo |
|--------|----------------|-----------------|
| Imagem 1 | Dashboard EBD | screenshot-dashboard.png |
| Imagem 2 | Alunos | screenshot-alunos.png |
| Imagem 3 | Professores | screenshot-professores.png |
| Imagem 4 | Turmas | screenshot-turmas.png |
| Imagem 5 | Ativar Revistas | screenshot-revistas.png |
| Imagem 6 | Escala | screenshot-escala.png |
| Imagem 7 | Lancamento Manual | screenshot-lancamento.png |
| Imagem 8 | Frequencia | screenshot-frequencia.png |
| Imagem 9 | Quizzes | screenshot-quizzes.png |
| Imagem 10 | Desafio Biblico | screenshot-desafio.png |
| Imagem 11 | Catalogo | screenshot-catalogo.png (falta enviar) |
| Imagem 12 | Meus Pedidos | screenshot-pedidos.png (falta enviar) |

**Nota:** Observei que as imagens 11 (Catalogo) e 12 (Meus Pedidos) nao foram enviadas ainda. Vou adicionar as 10 imagens disponiveis e manter placeholder para as faltantes.

---

## Implementacao

### Passo 1: Copiar imagens para o projeto
Copiar todas as imagens enviadas para `src/assets/apresentacao/`

### Passo 2: Atualizar componente FeatureCard
Modificar o componente para aceitar uma propriedade `screenshotUrl` opcional que, quando presente, exibe a imagem real em vez do placeholder.

### Passo 3: Atualizar array superintendenteFeatures
Adicionar a URL da imagem correspondente a cada item do array.

---

## Arquivos Modificados

1. **Criar pasta e copiar imagens**
   - `src/assets/apresentacao/` (nova pasta)
   - 10 arquivos de imagem

2. **src/pages/Apresentacao.tsx**
   - Importar as imagens
   - Modificar `FeatureCardProps` para incluir `screenshotUrl?: string`
   - Atualizar `FeatureCard` para exibir imagem quando disponivel
   - Atualizar `superintendenteFeatures` com as URLs das imagens

---

## Resultado Esperado
A aba "Painel do Superintendente" exibira screenshots reais do sistema, tornando a apresentacao muito mais profissional e ilustrativa das funcionalidades.
