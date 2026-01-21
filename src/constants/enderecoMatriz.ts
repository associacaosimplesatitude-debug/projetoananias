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
  referencia: "Central Gospel - Matriz",
  cnpj: "03.147.650/0001-52"
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
  referencia: "Central Gospel - Polo Pernambuco",
  cnpj: "03.147.650/0014-77"
};

/**
 * Endereço da Loja Penha para coleta de frete
 */
export const ENDERECO_PENHA = {
  rua: "Rua Honório Bicalho",
  numero: "102",
  complemento: "Térreo",
  bairro: "Penha",
  cidade: "Rio de Janeiro",
  estado: "RJ",
  cep: "21020-002",
  referencia: "Central Gospel - Loja Penha",
  cnpj: "03.147.650/0003-14"
};

/**
 * Tabela de caixas por faixa de peso
 */
export const TABELA_CAIXAS = [
  { min: 0, max: 1.5, tipo: 'Cx 60', dimensoes: '15x23x9 cm', comp: 15, larg: 23, alt: 9 },
  { min: 1.501, max: 3, tipo: 'Cx 75', dimensoes: '23,5x31,5x10 cm', comp: 23.5, larg: 31.5, alt: 10 },
  { min: 3.001, max: 6, tipo: 'Cx 05', dimensoes: '22,5x27x17 cm', comp: 22.5, larg: 27, alt: 17 },
  { min: 6.001, max: 15, tipo: 'Cx 02', dimensoes: '28,5x28,5x20 cm', comp: 28.5, larg: 28.5, alt: 20 },
  { min: 15.001, max: 20, tipo: 'Cx 03', dimensoes: '27x31x30 cm', comp: 27, larg: 31, alt: 30 },
  { min: 20.001, max: 30, tipo: 'Cx 01', dimensoes: '63x33x23 cm', comp: 63, larg: 33, alt: 23 },
];

export interface InfoCaixa {
  tipo: string;
  dimensoes: string;
  quantidade: number;
  pesoMaximo: number;
}

export interface InfoCaixaMultipla {
  caixas: Array<{
    tipo: string;
    dimensoes: string;
    quantidade: number;
  }>;
  totalVolumes: number;
}

/**
 * Calcula tipo e quantidade de caixas baseado no peso total
 * Regra: A cada 30kg adiciona mais 1 volume (sempre Cx 01 para volumes extras)
 */
export function calcularCaixas(pesoTotalKg: number): InfoCaixa {
  if (pesoTotalKg <= 0) {
    return { tipo: '-', dimensoes: '-', quantidade: 0, pesoMaximo: 0 };
  }

  // Calcular número de volumes de 30kg
  const volumesPrincipais = Math.ceil(pesoTotalKg / 30);
  
  if (volumesPrincipais === 1) {
    // Peso dentro de uma caixa - encontrar caixa ideal
    const caixa = TABELA_CAIXAS.find(c => pesoTotalKg >= c.min && pesoTotalKg <= c.max);
    if (caixa) {
      return { 
        tipo: caixa.tipo, 
        dimensoes: caixa.dimensoes, 
        quantidade: 1, 
        pesoMaximo: caixa.max 
      };
    }
    // Se não encontrar (peso entre 20 e 30kg), usar Cx 01
    return { tipo: 'Cx 01', dimensoes: '63x33x23 cm', quantidade: 1, pesoMaximo: 30 };
  }
  
  // Múltiplos volumes - usar Cx 01 para todos
  return { 
    tipo: 'Cx 01', 
    dimensoes: '63x33x23 cm', 
    quantidade: volumesPrincipais, 
    pesoMaximo: 30 
  };
}

/**
 * Calcula tipo e quantidade de caixas de forma detalhada
 * Retorna combinação de caixas (ex: 1x Cx 01 + 1x Cx 02 para 39kg)
 */
export function calcularCaixasDetalhado(pesoTotalKg: number): InfoCaixaMultipla {
  if (pesoTotalKg <= 0) {
    return { caixas: [], totalVolumes: 0 };
  }

  // Peso cabe em uma única caixa
  if (pesoTotalKg <= 30) {
    const caixa = TABELA_CAIXAS.find(c => pesoTotalKg >= c.min && pesoTotalKg <= c.max);
    if (caixa) {
      return { 
        caixas: [{ tipo: caixa.tipo, dimensoes: caixa.dimensoes, quantidade: 1 }],
        totalVolumes: 1
      };
    }
    // Peso entre 20-30kg usa Cx 01
    return { 
      caixas: [{ tipo: 'Cx 01', dimensoes: '63x33x23 cm', quantidade: 1 }],
      totalVolumes: 1
    };
  }

  // Peso > 30kg: calcular volumes de 30kg + resto
  const volumesCheios = Math.floor(pesoTotalKg / 30);  // Quantas Cx 01 cheias
  const pesoRestante = pesoTotalKg % 30;               // Sobra

  const caixas: Array<{ tipo: string; dimensoes: string; quantidade: number }> = [];
  
  // Adicionar Cx 01 para volumes cheios
  if (volumesCheios > 0) {
    caixas.push({ tipo: 'Cx 01', dimensoes: '63x33x23 cm', quantidade: volumesCheios });
  }

  // Adicionar caixa adequada para o peso restante
  if (pesoRestante > 0) {
    const caixaResto = TABELA_CAIXAS.find(c => pesoRestante >= c.min && pesoRestante <= c.max);
    if (caixaResto) {
      caixas.push({ tipo: caixaResto.tipo, dimensoes: caixaResto.dimensoes, quantidade: 1 });
    } else if (pesoRestante > 20) {
      // Resto entre 20-30kg também usa Cx 01
      caixas.push({ tipo: 'Cx 01', dimensoes: '63x33x23 cm', quantidade: 1 });
    }
  }

  return { 
    caixas,
    totalVolumes: caixas.reduce((sum, c) => sum + c.quantidade, 0)
  };
}

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

export function formatarEnderecoPenha(): string {
  return `${ENDERECO_PENHA.rua}, ${ENDERECO_PENHA.numero}, ${ENDERECO_PENHA.complemento}
${ENDERECO_PENHA.bairro} - ${ENDERECO_PENHA.cidade}/${ENDERECO_PENHA.estado}
CEP: ${ENDERECO_PENHA.cep}`;
}

export function formatarEnderecoPenhaLinha(): string {
  return `${ENDERECO_PENHA.rua}, ${ENDERECO_PENHA.numero}, ${ENDERECO_PENHA.complemento} - ${ENDERECO_PENHA.bairro}, ${ENDERECO_PENHA.cidade}/${ENDERECO_PENHA.estado} - CEP: ${ENDERECO_PENHA.cep}`;
}
