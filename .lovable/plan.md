

## Problema

O botão "Registrar Webhook" está no código (linha 516) mas provavelmente não é visível porque:
- O `<header>` usa `flex justify-between` com potencialmente 3 filhos diretos (título, div admin buttons, botão webhook)
- O botão pode estar oculto atrás dos outros elementos ou fora da viewport

## Solução

Mover o botão "Registrar Webhook" para **dentro** do mesmo `<div className="flex gap-2">` dos outros botões, mas **fora** do `{canAccessAdminEBD && ...}` — criando um wrapper flex que sempre renderiza, com o botão webhook sempre visível e os botões admin condicionais ao lado.

### Alteração em `src/pages/shopify/PedidosOnline.tsx`

**Antes** (linhas 464-530):
```
<header className="flex items-center justify-between">
  <div>título...</div>
  {canAccessAdminEBD && (
    <div className="flex gap-2">
      ...botões admin...
      Sincronizar Pedidos
    </div>
  )}
  <Button>Registrar Webhook</Button>  ← solto no header
</header>
```

**Depois:**
```
<header className="flex items-center justify-between">
  <div>título...</div>
  <div className="flex gap-2">
    {canAccessAdminEBD && (
      <>...botões admin + Sincronizar Pedidos</>
    )}
    <Button>Registrar Webhook</Button>  ← dentro do mesmo flex group
  </div>
</header>
```

Isso garante que o botão sempre aparece agrupado com os outros botões no lado direito do header.

