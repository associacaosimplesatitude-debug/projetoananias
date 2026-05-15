import { describe, it, expect } from "vitest";
import { detectWhatsappCountry, formatWhatsappDisplay } from "./whatsappFormat";

describe("detectWhatsappCountry", () => {
  it("detecta Portugal (12 dígitos com 351)", () => {
    expect(detectWhatsappCountry("351922211394")).toBe("PT");
  });

  it("detecta EUA (11 dígitos com 1, 3º dígito != 9)", () => {
    expect(detectWhatsappCountry("17815586729")).toBe("US");
    expect(detectWhatsappCountry("13057265041")).toBe("US");
    expect(detectWhatsappCountry("16174617575")).toBe("US");
  });

  it("celular BR de DDD com '1' continua BR (3º dígito = 9)", () => {
    expect(detectWhatsappCountry("15991616340")).toBe("BR");
    expect(detectWhatsappCountry("16981648852")).toBe("BR");
    expect(detectWhatsappCountry("11999998888")).toBe("BR");
  });

  it("fixo BR 10 dígitos é BR", () => {
    expect(detectWhatsappCountry("1133334444")).toBe("BR");
  });

  it("fallback BR para vazio/curto/desconhecido", () => {
    expect(detectWhatsappCountry("")).toBe("BR");
    expect(detectWhatsappCountry("5511999998888")).toBe("BR");
  });

  it("ignora caracteres não-numéricos", () => {
    expect(detectWhatsappCountry("+1 (781) 558-6729")).toBe("US");
    expect(detectWhatsappCountry("+351 922 211 394")).toBe("PT");
  });
});

describe("formatWhatsappDisplay", () => {
  it("formata EUA como +1 (XXX) XXX-XXXX", () => {
    expect(formatWhatsappDisplay("17815586729")).toEqual({
      country: "US",
      formatted: "+1 (781) 558-6729",
    });
    expect(formatWhatsappDisplay("13057265041").formatted).toBe("+1 (305) 726-5041");
    expect(formatWhatsappDisplay("16174617575").formatted).toBe("+1 (617) 461-7575");
  });

  it("formata Portugal como +351 XXX XXX XXX", () => {
    expect(formatWhatsappDisplay("351922211394")).toEqual({
      country: "PT",
      formatted: "+351 922 211 394",
    });
  });

  it("formata celular BR como +55 (DD) XXXXX-XXXX", () => {
    expect(formatWhatsappDisplay("15991616340")).toEqual({
      country: "BR",
      formatted: "+55 (15) 99161-6340",
    });
    expect(formatWhatsappDisplay("11999998888").formatted).toBe("+55 (11) 99999-8888");
  });

  it("formata fixo BR como +55 (DD) XXXX-XXXX", () => {
    expect(formatWhatsappDisplay("1133334444")).toEqual({
      country: "BR",
      formatted: "+55 (11) 3333-4444",
    });
  });

  it("entrada vazia retorna placeholder", () => {
    expect(formatWhatsappDisplay("")).toEqual({ country: null, formatted: "—" });
  });

  it("aceita entrada com máscara", () => {
    expect(formatWhatsappDisplay("+1 (781) 558-6729").formatted).toBe("+1 (781) 558-6729");
    expect(formatWhatsappDisplay("+351 922 211 394").formatted).toBe("+351 922 211 394");
  });
});
