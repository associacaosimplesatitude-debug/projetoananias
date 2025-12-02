// Lista centralizada de faixas etárias para EBD
// Usada tanto no cadastro de Revistas quanto no cadastro de Turmas
export const FAIXAS_ETARIAS = [
  "Maternal: 2 a 3 Anos",
  "Jardim de Infância: 4 a 6 Anos",
  "Primários: 7 a 8 Anos",
  "Juniores: 9 a 11 Anos",
  "Adolescentes: 12 a 14 Anos",
  "Adolescentes+: 15 a 17 Anos",
  "Jovens e Adultos",
] as const;

export type FaixaEtaria = typeof FAIXAS_ETARIAS[number];
