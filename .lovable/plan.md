## Objetivo

Em `/admin/ebd/revista-licencas`, exibir corretamente os números de WhatsApp internacionais com:
- Bandeira do país (🇧🇷 / 🇵🇹 / 🇺🇸)
- Número completo formatado com DDI (ex.: `+351 938 048 481`)

Apenas mudanças visuais — sem alterar webhooks, fluxos de mensagens, normalização armazenada no banco ou edge functions.

## Como o dado está armazenado hoje

Conforme a memória de roteamento internacional:
- Brasil: 11 dígitos sem DDI (ex.: `35193804848`)
- Portugal: DDI + local → `351` + 9 dígitos (ex.: `351938048481`, total 12)
- EUA: DDI + local → `1` + 10 dígitos (ex.: `15551234567`, total 11 começando por `1`)

A função atual `formatWhatsappMask` aplica mascara fixa `(XX) XXXXX-XXXX` em tudo, deixando números PT/US visualmente quebrados como `(35) 19380-4848` (caso da imagem enviada).

## Mudanças (somente visuais)

Arquivo único: `src/pages/admin/RevistaLicencasAdmin.tsx`

### 1. Novo helper de detecção e formatação

Substituir/Acrescentar utilitários (perto de `formatWhatsappMask`, linha 365):

```ts
// Detecta país a partir dos dígitos armazenados
function detectCountry(digits: string): "BR" | "PT" | "US" {
  if (digits.startsWith("351") && digits.length === 12) return "PT";
  if (digits.startsWith("1") && digits.length === 11) return "US";
  return "BR"; // 10 ou 11 dígitos sem DDI
}

// Formata para exibição com DDI completo
function formatWhatsappDisplay(raw: string): { flag: string; formatted: string } {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return { flag: "", formatted: "—" };
  const country = detectCountry(digits);
  if (country === "PT") {
    const local = digits.slice(3); // 9 dígitos
    return { flag: "🇵🇹", formatted: `+351 ${local.slice(0,3)} ${local.slice(3,6)} ${local.slice(6)}` };
  }
  if (country === "US") {
    const local = digits.slice(1); // 10 dígitos
    return { flag: "🇺🇸", formatted: `+1 (${local.slice(0,3)}) ${local.slice(3,6)}-${local.slice(6)}` };
  }
  // BR
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const local = rest.length === 9
    ? `${rest.slice(0,5)}-${rest.slice(5)}`
    : `${rest.slice(0,4)}-${rest.slice(4)}`;
  return { flag: "🇧🇷", formatted: `+55 (${ddd}) ${local}` };
}
```

### 2. Tabela de licenças (linha 902)

Trocar `<TableCell>{l.whatsapp}</TableCell>` por uma célula que renderiza bandeira + número:

```tsx
<TableCell>
  {(() => {
    const { flag, formatted } = formatWhatsappDisplay(l.whatsapp);
    return <span className="inline-flex items-center gap-1.5"><span>{flag}</span>{formatted}</span>;
  })()}
</TableCell>
```

### 3. Drawer "Detalhes da Licença" (linhas 379, 388, 484-486)

O input editável atualmente força máscara BR. Para preservar a edição sem alterar fluxo, mas exibindo corretamente:

- No `setEditWhatsapp(...)` inicial (linha 388): usar `formatWhatsappDisplay(licenca?.whatsapp || "").formatted` em vez de `formatWhatsappMask(...)`.
- No `onChange` do Input (linha 485): substituir `formatWhatsappMask` por uma versão que reaplica `formatWhatsappDisplay` aos dígitos digitados, mantendo a detecção dinâmica conforme o usuário digita (DDI 55/351/1 ou 10–11 dígitos puros = BR).
- Adicionar a bandeira como prefixo visual ao lado do label do input ou dentro do campo:

```tsx
<Label className="flex items-center gap-1.5 mb-1.5">
  <Phone className="h-3.5 w-3.5" />
  WhatsApp
  <span className="ml-1">{formatWhatsappDisplay(editWhatsapp).flag}</span>
</Label>
<Input
  value={formatWhatsappDisplay(editWhatsapp).formatted}
  onChange={(e) => setEditWhatsapp(e.target.value.replace(/\D/g, ""))}
  placeholder="+55 (11) 98765-4321"
  maxLength={22}
/>
```

Armazenar internamente apenas dígitos crus; a normalização enviada ao backend (linha 433: `editWhatsapp.replace(/\D/g, "")`) continua igual, garantindo que **nenhuma lógica de salvamento ou roteamento muda**.

### 4. Sem mudanças em

- Edge functions (`revista-licencas-shopify-admin`, etc.)
- Lógica de busca/filtro (linha 769) — `l.whatsapp?.includes(s)` continua funcionando sobre os dígitos crus
- Webhooks, automações, envio de mensagens, templates
- Esquema do banco

## Resultado esperado

- Linha do Wagner (PT) na tabela passa a aparecer como `🇵🇹 +351 938 048 481` em vez de `(35) 19380-4848`.
- Drawer mostra bandeira ao lado do label "WhatsApp" e o número completo no campo.
- Números brasileiros antigos continuam exibidos como `🇧🇷 +55 (35) 99999-9999`.
