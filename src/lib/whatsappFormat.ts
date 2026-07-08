// Utilitários de detecção de país e formatação de números de WhatsApp.
// Centralizado para reuso e cobertura por testes.
//
// Regras de detecção (entrada: somente dígitos):
// - PT: 12 dígitos começando com "351".
// - US: 11 dígitos começando com "1" e 3º dígito ≠ "9".
//   (Celular brasileiro armazenado sem DDI sempre tem o 3º dígito = "9":
//    DDD + 9 + 8 dígitos. Códigos de área dos EUA começam em 2-9, então
//    qualquer "1XYZ..." com Y != 9 é EUA.)
// - BR: demais casos (10–11 dígitos sem DDI, ou outros formatos).

export type WhatsappCountry = "BR" | "PT" | "US";

export function detectWhatsappCountry(digits: string): WhatsappCountry {
  const d = (digits || "").replace(/\D/g, "");
  if (d.startsWith("351") && d.length === 12) return "PT";
  if (d.length === 11 && d.startsWith("1") && d[2] !== "9") return "US";
  return "BR";
}

export interface FormattedWhatsapp {
  country: WhatsappCountry | null;
  formatted: string;
}

export function normalizeWhatsappDigits(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");

  if (!digits) return "";

  // O campo brasileiro é exibido com "+55". Ao digitar em um input controlado,
  // esse prefixo aparece dentro do valor do evento e precisa ser removido sempre,
  // não apenas quando já há 11 dígitos.
  if ((raw || "").trim().startsWith("+55")) {
    digits = digits.slice(2);
  }

  // Corrige valores antigos/sujos salvos com DDI brasileiro duplicado.
  while (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  return digits;
}

export function formatWhatsappDisplay(raw: string): FormattedWhatsapp {
  const digits = normalizeWhatsappDigits(raw);
  if (!digits) return { country: null, formatted: "—" };
  const country = detectWhatsappCountry(digits);

  if (country === "PT") {
    const local = digits.slice(3);
    return {
      country,
      formatted: `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`.trim(),
    };
  }

  if (country === "US") {
    // Garantir sempre +1 (XXX) XXX-XXXX
    const local = digits.slice(1);
    const area = local.slice(0, 3);
    const mid = local.slice(3, 6);
    const end = local.slice(6, 10);
    return { country, formatted: `+1 (${area}) ${mid}-${end}` };
  }

  // BR
  if (digits.length < 3) return { country: "BR", formatted: `+55 ${digits}` };
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const local =
    rest.length === 9
      ? `${rest.slice(0, 5)}-${rest.slice(5)}`
      : rest.length === 8
        ? `${rest.slice(0, 4)}-${rest.slice(4)}`
        : rest;
  return { country: "BR", formatted: `+55 (${ddd}) ${local}` };
}
