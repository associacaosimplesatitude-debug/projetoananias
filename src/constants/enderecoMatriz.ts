/**
 * Endereço da Matriz Central Gospel para coleta de frete
 */
export const ENDERECO_MATRIZ = {
  rua: "Estrada do Guerenguê",
  numero: "1851",
  bairro: "Taquara",
  cidade: "Rio de Janeiro",
  estado: "RJ",
  cep: "22713-001",
  referencia: "Central Gospel - Matriz"
};

export function formatarEnderecoMatriz(): string {
  return `${ENDERECO_MATRIZ.rua}, ${ENDERECO_MATRIZ.numero}
${ENDERECO_MATRIZ.bairro} - ${ENDERECO_MATRIZ.cidade}/${ENDERECO_MATRIZ.estado}
CEP: ${ENDERECO_MATRIZ.cep}`;
}

export function formatarEnderecoMatrizLinha(): string {
  return `${ENDERECO_MATRIZ.rua}, ${ENDERECO_MATRIZ.numero} - ${ENDERECO_MATRIZ.bairro}, ${ENDERECO_MATRIZ.cidade}/${ENDERECO_MATRIZ.estado} - CEP: ${ENDERECO_MATRIZ.cep}`;
}
