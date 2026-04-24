## Ajustes na página `/sorteio`

Três correções pontuais na página pública do sorteio (`src/pages/public/SorteioLanding.tsx`).

---

### 1. Corrigir banner cortando preletoras nas laterais

**Problema:** O banner usa `object-cover object-top` com altura fixa (`h-[340px] md:h-[480px]`), o que corta as laterais da imagem em telas estreitas (ex.: 390px de viewport mostra só as preletoras centrais).

**Solução:** Trocar para `object-contain` em mobile (mostra a imagem inteira sem corte) e manter `object-cover` em desktop, com fundo escuro casando com o tema (`bg-[#0f172a]`). Reduzir um pouco a altura mobile para evitar áreas vazias grandes.

```tsx
<section className="relative w-full bg-[#0f172a]">
  <img
    src={bannerUrl}
    alt={evento.nome}
    className="w-full h-auto md:h-[480px] md:object-cover md:object-center"
  />
  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f172a] pointer-events-none" />
</section>
```

Resultado: no mobile o banner aparece inteiro (todas as preletoras visíveis); no desktop continua imersivo cobrindo a largura.

---

### 2. Adicionar countdown para o primeiro sorteio (pré-evento)

**Problema:** Hoje o countdown só aparece quando existe uma `sorteio_sessao` com `ativo = true`. Antes do evento começar, a tela fica sem nenhuma indicação de quanto falta para o primeiro sorteio.

**Solução:** Calcular o "próximo sorteio" considerando duas situações:

- **Se há sessão ativa** → comportamento atual (próximo intervalo dentro da sessão).
- **Se não há sessão ativa** → buscar a próxima sessão futura do evento (a mais próxima onde `data_inicio > now`) e usar `data_inicio` como momento do primeiro sorteio.

Mudanças:

a) Nova query `proximaSessaoFutura` que busca a primeira sessão do evento ativo cujo `data_inicio` ainda não chegou:

```ts
const { data: proximaSessaoFutura } = useQuery({
  queryKey: ["sorteio-proxima-sessao", evento?.id],
  enabled: !!evento?.id && !sessaoAtiva,
  queryFn: async () => {
    const { data } = await supabase
      .from("sorteio_sessoes")
      .select("*")
      .eq("evento_id", evento!.id)
      .gt("data_inicio", new Date().toISOString())
      .order("data_inicio", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data;
  },
  refetchInterval: 60000,
});
```

b) Ajustar `proximoSorteio` para usar `proximaSessaoFutura.data_inicio` quando não houver sessão ativa.

c) Renderizar o card de countdown também no estado "sem sessão ativa" quando há uma sessão futura agendada (substituindo o atual texto "Aguarde o próximo sorteio" por um countdown real com label "Primeiro sorteio em").

Isso resolve o caso descrito: evento amanhã às 13h, primeiro sorteio às 14h → o site mostrará a contagem regressiva ainda hoje.

---

### 3. Remover o QR Code

**Problema:** Quem abre o `/sorteio` no celular não precisa escanear um QR para acessar a própria página em que já está.

**Solução:** Remover por completo o bloco da seção `{/* QR Code */}` (linhas 514-526) e remover os imports não usados (`QRCodeSVG`, `Share2`).

---

### Arquivo afetado

- `src/pages/public/SorteioLanding.tsx` — única alteração necessária.

Nenhuma mudança de banco, edge function ou outro componente.
