## Bug
No modal "Detalhes da Licença" (ebd/revista-licencas), o campo WhatsApp usa um `Input` controlado que exibe o valor já formatado (`formatWhatsappDisplay(editWhatsapp).formatted` → ex.: `+55 (11) 98765-4321`), mas o `onChange` apenas remove não-dígitos do valor formatado. Como o "55" do prefixo `+55` é dígito, ele volta pro estado, e a cada tecla o "55" fica acumulando/duplicando no início do número.

## Fix
Em `src/pages/admin/RevistaLicencasAdmin.tsx` (linha ~552), normalizar a entrada removendo o DDI antes de salvar no estado, para armazenar sempre no formato canônico já usado no projeto (BR: 10–11 dígitos sem `55`; PT: mantém `351`; US: mantém `1`).

Novo handler:
```ts
onChange={(e) => {
  let d = e.target.value.replace(/\D/g, "");
  // remove DDI BR duplicado inserido pelo display "+55"
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  setEditWhatsapp(d);
}}
```

Nenhuma outra alteração é necessária — a exibição continua via `formatWhatsappDisplay` e o `updateMutation` já grava `editWhatsapp.replace(/\D/g, "")`.
