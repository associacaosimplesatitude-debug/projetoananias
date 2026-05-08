// Utilitários de normalização de telefone para o agente Loja CG.
// Regra do projeto: armazenar como 11 dígitos (DDD + número), sem +55.
// Mas variantes podem existir no banco — gerar todas para busca robusta.

export function normalizarTelefone(input: string): string {
  return (input || "").replace(/\D/g, "");
}

/**
 * Gera variações plausíveis de um telefone:
 * - 11 dígitos (DDD + 9 + 8 dígitos)
 * - 10 dígitos (DDD + 8 dígitos, sem o 9)
 * - 13 dígitos (55 + 11)
 * - 12 dígitos (55 + 10)
 */
export function gerarVariantes(input: string): string[] {
  const d = normalizarTelefone(input);
  if (!d) return [];
  const set = new Set<string>();
  set.add(d);

  let core = d;
  if (core.startsWith("55") && (core.length === 12 || core.length === 13)) {
    core = core.slice(2);
  }

  if (core.length === 11) {
    // remove o 9 do meio para gerar a versão de 10
    const semNove = core.slice(0, 2) + core.slice(3);
    set.add(core);
    set.add(semNove);
    set.add("55" + core);
    set.add("55" + semNove);
  } else if (core.length === 10) {
    const comNove = core.slice(0, 2) + "9" + core.slice(2);
    set.add(core);
    set.add(comNove);
    set.add("55" + core);
    set.add("55" + comNove);
  }

  return Array.from(set);
}
