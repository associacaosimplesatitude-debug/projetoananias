

# Solucao Definitiva: Modal com Portal React Customizado

## Problema Raiz
O `AlertDialogContent` do Radix UI aplica internamente classes de posicionamento (`fixed left-[50%] top-[50%] translate-x/y`) que conflitam com as classes adicionadas no componente. Independente das classes que adicionamos por cima, o comportamento base do Radix continua interferindo, causando o modal aparecer cortado no rodape.

## Solucao
Abandonar o `AlertDialog` do Radix para este componente e criar um modal customizado usando `ReactDOM.createPortal`, renderizando diretamente no `body` com controle total sobre o posicionamento.

## Mudancas

### Arquivo: `src/components/vendedor/FaturamentoModeDialog.tsx`
Reescrever o componente para usar `ReactDOM.createPortal` ao inves de `AlertDialog`:

1. **Overlay (camada de fundo)**:
   - `fixed inset-0 z-[9999] flex items-center justify-center bg-black/50`
   - Cobre toda a tela, centraliza o conteudo, z-index alto para ficar acima de tudo

2. **Conteudo interno (caixa do modal)**:
   - `bg-background rounded-lg shadow-lg w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 m-auto relative`
   - Altura maxima de 90vh com scroll interno
   - `m-auto` para centralizacao
   - Sem heranca de estilos de footer/rodape

3. **Botao X**: Mantido com posicionamento absoluto no canto superior direito

4. **Fechamento**: Clicar no overlay (fundo escuro) fecha o modal, assim como o botao X

5. **Condicional**: O modal so renderiza quando `open === true`, sem animacoes complexas que possam interferir no posicionamento

### Estrutura do componente

```text
createPortal(
  +------------------------------------------+
  | overlay: fixed inset-0 z-[9999]          |
  | flex items-center justify-center         |
  | bg-black/50                              |
  |                                          |
  |   +----------------------------------+   |
  |   | content: max-w-lg max-h-[90vh]   |   |
  |   | overflow-y-auto p-6 m-auto       |   |
  |   | bg-background rounded-lg         |   |
  |   |                                  |   |
  |   |  [X]  Titulo + Descricao         |   |
  |   |                                  |   |
  |   |  [Botao Faturar]                 |   |
  |   |  [Botao Pagamento Padrao]        |   |
  |   +----------------------------------+   |
  +------------------------------------------+
  , document.body
)
```

Esta abordagem elimina completamente qualquer interferencia do Radix AlertDialog e garante que o modal sempre apareca centralizado na tela.
