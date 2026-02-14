
# Adicionar Periodo Personalizado ao Sincronizar Royalties

## Problema
Atualmente o botao de sincronizacao so oferece periodos fixos (30, 60, 90, 180 dias, desde Jan). Para sincronizacoes manuais pontuais, o usuario precisa de um seletor de datas personalizado.

## Solucao
Adicionar uma opcao "Periodo personalizado" no dropdown que abre um popover com dois date pickers (data inicio e data fim). A edge function ja recebe `days_back` e calcula as datas internamente, mas tambem aceita `dataInicialStr` e `dataFinalStr` na funcao `syncNFeBatch`. Vamos atualizar a edge function para aceitar datas customizadas diretamente.

## Alteracoes

### 1. Edge Function `bling-sync-royalties-sales/index.ts`
- Aceitar parametros opcionais `data_inicio` e `data_fim` (formato YYYY-MM-DD) no body
- Se fornecidos, usar essas datas ao inves de calcular via `days_back`
- Manter compatibilidade: se nao enviados, funciona como antes com `days_back`

### 2. Componente `BlingSyncButton.tsx`
- Adicionar estado para controlar a abertura de um Dialog/Popover de periodo personalizado
- Adicionar opcao "Periodo personalizado" no dropdown existente
- Ao clicar, abrir um Dialog com dois date pickers (Data Inicio e Data Fim)
- Botao "Sincronizar" no dialog que chama a funcao com as datas escolhidas
- Usar os componentes Shadcn existentes: Dialog, Calendar, Popover
- Calcular `days_back` a partir da diferenca entre as duas datas e enviar `data_inicio`/`data_fim` diretamente para a edge function

### 3. Fluxo do usuario
1. Clica no chevron do botao de sincronizar
2. Ve as opcoes existentes + "Periodo personalizado"
3. Ao clicar em "Periodo personalizado", abre um dialog
4. Seleciona data inicio e data fim
5. Clica "Sincronizar" e o processo roda normalmente com feedback de progresso

## Detalhes Tecnicos

### Parametros novos na Edge Function
```text
body: {
  days_back?: number,      // existente
  data_inicio?: string,    // novo (YYYY-MM-DD)
  data_fim?: string,       // novo (YYYY-MM-DD)
  max_nfes?: number,       // existente
  skip?: number,           // existente
}
```

### Logica na Edge Function
```text
if (body.data_inicio && body.data_fim) {
  dataInicialStr = body.data_inicio;
  dataFinalStr = body.data_fim;
} else {
  // calculo existente com days_back
}
```

### Componentes utilizados
- `Dialog` para o formulario de periodo
- `Calendar` com `Popover` para os date pickers (padrao Shadcn)
- `Button` para confirmar

## Tambem inclui
- O cron job diario (conforme plano anterior aprovado):
  - Habilitar extensoes `pg_cron` e `pg_net`
  - Alterar `verify_jwt = false` no config.toml
  - Criar cron schedule para rodar diariamente as 00:00 Brasilia
