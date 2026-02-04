
# Plano: Atualizar Templates de Email com Logo Central Gospel

## Objetivo

Substituir o texto "Projeto Ananias" pelo logo da **Central Gospel Editora** em todos os 6 templates de email do sistema de royalties.

## O que sera alterado

| Template | Alteracao |
|----------|-----------|
| `autor_acesso` | Remover "Projeto Ananias", adicionar logo |
| `royalty_venda` | Remover "Projeto Ananias", adicionar logo |
| `pagamento_realizado` | Remover "Projeto Ananias", adicionar logo |
| `relatorio_mensal` | Remover "Projeto Ananias", adicionar logo |
| `afiliado_venda` | Remover "Projeto Ananias", adicionar logo |
| `afiliado_link` | Remover "Projeto Ananias", adicionar logo |

## Mudancas no HTML

**Antes (header atual):**
```html
<div class="header">
  <h1>Projeto Ananias</h1>
</div>
```

**Depois (com logo):**
```html
<div class="header">
  <img src="https://gestaoebd.lovable.app/logos/logo-central-gospel.png" 
       alt="Central Gospel Editora" 
       style="max-width:250px;height:auto">
</div>
```

**Footer - Antes:**
```html
<div class="footer">
  <p>Projeto Ananias - Sistema de Royalties</p>
</div>
```

**Footer - Depois:**
```html
<div class="footer">
  <p>Central Gospel Editora - Sistema de Royalties</p>
</div>
```

## Acoes

1. Copiar o logo horizontal da Central Gospel para a pasta publica (caso necessario usar a versao horizontal)
2. Atualizar os 6 templates no banco de dados via SQL

---

## Secao Tecnica

### Imagem do Logo

O projeto ja possui o logo em `public/logos/logo-central-gospel.png`. Vou copiar a versao horizontal enviada (`horizontal-2.png`) para o projeto e usa-la nos emails, pois ficara melhor no header.

**Novo arquivo:** `public/logos/logo-central-gospel-horizontal.png`

**URL publica:** `https://gestaoebd.lovable.app/logos/logo-central-gospel-horizontal.png`

### SQL de Atualizacao

Sera executado um UPDATE para cada template substituindo:

1. `<h1>Projeto Ananias</h1>` por tag `<img>` com o logo
2. `Projeto Ananias - Sistema de Royalties` por `Central Gospel Editora`

### Compatibilidade de Email

- Usar `<img>` com atributos inline para compatibilidade com clientes de email
- Usar URL absoluta (https://gestaoebd.lovable.app/...) para que a imagem carregue corretamente
- Manter estilos inline para compatibilidade maxima
