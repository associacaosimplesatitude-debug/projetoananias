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

/**
 * Endereço do Polo Pernambuco para coleta de frete
 */
export const ENDERECO_PERNAMBUCO = {
  rua: "Rua Adalberto Coimbra",
  numero: "211",
  complemento: "Galpão B",
  bairro: "Jardim Jordão",
  cidade: "Jaboatão dos Guararapes",
  estado: "PE",
  cep: "54315-110",
  referencia: "Central Gospel - Polo Pernambuco"
};

export function formatarEnderecoMatriz(): string {
  return `${ENDERECO_MATRIZ.rua}, ${ENDERECO_MATRIZ.numero}
${ENDERECO_MATRIZ.bairro} - ${ENDERECO_MATRIZ.cidade}/${ENDERECO_MATRIZ.estado}
CEP: ${ENDERECO_MATRIZ.cep}`;
}

export function formatarEnderecoMatrizLinha(): string {
  return `${ENDERECO_MATRIZ.rua}, ${ENDERECO_MATRIZ.numero} - ${ENDERECO_MATRIZ.bairro}, ${ENDERECO_MATRIZ.cidade}/${ENDERECO_MATRIZ.estado} - CEP: ${ENDERECO_MATRIZ.cep}`;
}

export function formatarEnderecoPernambuco(): string {
  return `${ENDERECO_PERNAMBUCO.rua}, ${ENDERECO_PERNAMBUCO.numero}, ${ENDERECO_PERNAMBUCO.complemento}
${ENDERECO_PERNAMBUCO.bairro} - ${ENDERECO_PERNAMBUCO.cidade}/${ENDERECO_PERNAMBUCO.estado}
CEP: ${ENDERECO_PERNAMBUCO.cep}`;
}

export function formatarEnderecoPernambucaLinha(): string {
  return `${ENDERECO_PERNAMBUCO.rua}, ${ENDERECO_PERNAMBUCO.numero}, ${ENDERECO_PERNAMBUCO.complemento} - ${ENDERECO_PERNAMBUCO.bairro}, ${ENDERECO_PERNAMBUCO.cidade}/${ENDERECO_PERNAMBUCO.estado} - CEP: ${ENDERECO_PERNAMBUCO.cep}`;
}
