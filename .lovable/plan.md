
Objetivo

Fazer o painel `/admin/ebd/revista-mapa` contabilizar corretamente os acessos já registrados e plotar qualquer acesso que tenha coordenadas por IP ou por GPS.

Diagnóstico confirmado

- O rastreamento em `RevistaLeitura.tsx` está disparando normalmente.
- O console mostrado por você prova isso:
  - `trackAcesso chamada com 5 licenças`
  - `ipapi.co data: {}`
  - 5 logs `revista_acessos_geo inserido: { id: ... }`
- Portanto, o problema principal não é o insert no banco.
- O gargalo está em `src/pages/admin/RevistaMapa.tsx`: a query atual faz:
  - `.not("latitude", "is", null)`
- Como o `ipapi.co` retornou `{}`, os registros foram salvos com `latitude/longitude = null`.
- Mesmo que o GPS tenha atualizado depois `latitude_gps/longitude_gps`, esses registros continuam sendo excluídos da query, porque o filtro olha apenas `latitude`.
- O próprio `MapaLeaflet` já foi escrito para usar:
  - `latitude_gps ?? latitude`
  - `longitude_gps ?? longitude`
  Então hoje o componente aceita GPS, mas a query impede esses registros de chegarem até ele.
- Observação importante para teste: `trackAcesso` usa uma chave diária em `sessionStorage`. No mesmo navegador, no mesmo dia, reabrir a página pode não gerar novo insert.

Implementação proposta

1. Ajustar `RevistaMapa.tsx` para parar de filtrar no SQL apenas por `latitude`.
2. Buscar todos os registros da tabela e separar no frontend:
   - `acessosFiltrados`: todos os acessos da revista selecionada
   - `pontosMapeaveis`: só os acessos com coordenadas válidas, considerando:
     - `latitude_gps/longitude_gps`
     - ou `latitude/longitude`
3. Atualizar os cards para usar `acessosFiltrados`, não apenas pontos com latitude IP:
   - Total de acessos
   - Cidades únicas
   - Estados únicos
   - % mobile vs desktop
4. Passar `pontosMapeaveis` para `MapaLeaflet`.
5. Adicionar estado vazio claro no mapa quando existirem acessos sem coordenadas:
   - exemplo: “Há acessos registrados, mas nenhum com coordenadas disponíveis para plotagem.”
6. Em `RevistaLeitura.tsx`, manter o tracking atual e complementar a instrumentação do GPS para fechar o diagnóstico operacional:
   - log de sucesso no update GPS
   - log de erro no update GPS
   - log quando a permissão for negada/timeout
   Isso ajuda a separar dois cenários:
   - acesso foi gravado mas sem coordenadas
   - acesso foi gravado e geolocalizado corretamente
7. Não mexer no banco nem em RLS nesta etapa, porque o insert já está funcionando.

Arquivos envolvidos

- `src/pages/admin/RevistaMapa.tsx`
- `src/pages/revista/RevistaLeitura.tsx`

Critérios de aceite

- Um acesso com `latitude = null` mas `latitude_gps` preenchida aparece no mapa.
- O card “Total de acessos” passa a refletir os registros inseridos, mesmo quando o `ipapi.co` falhar.
- O mapa continua usando Leaflet via CDN + OpenStreetMap.
- O console deixa claro se o GPS foi salvo ou se o navegador não concedeu a localização.

Detalhes técnicos

```text
Fluxo esperado

/revista/leitura
  -> INSERT em revista_acessos_geo
  -> tentativa de update com GPS
/admin/ebd/revista-mapa
  -> busca todos os acessos
  -> cards contam todos os registros
  -> mapa plota apenas registros com coordenadas válidas
```

Risco residual

- Se o `ipapi.co` continuar retornando `{}` e o usuário negar GPS, o acesso deve continuar sendo contabilizado nos cards, mas não poderá virar marcador no mapa. Isso é comportamento esperado e deve ficar explícito na interface.
