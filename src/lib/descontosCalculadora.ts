/**
 * Cálculo de descontos para a calculadora de frete (produtos locais, não Shopify)
 */

import { categorizarProduto, getNomeCategoria } from "@/constants/categoriasShopify";

export interface ItemCalculadora {
  id: string;
  titulo: string;
  peso_bruto: number;
  preco_cheio: number;
  categoria: string | null;
  quantidade: number;
}

export interface DescontosCategoriaRepresentante {
  [categoria: string]: number; // categoria -> percentual
}

export interface CalculoDescontoLocal {
  subtotal: number;
  descontoPercentual: number;
  descontoValor: number;
  total: number;
  tipoDesconto: "advec" | "setup" | "revendedor" | "representante" | "vendedor" | "categoria" | "nenhum";
  faixa: string;
}

// IDs/Títulos dos produtos com desconto ADVEC de 50%
const PRODUTOS_ADVEC_50_TITULOS = [
  "evangelho de joão",
  "evangelho de joao",
  "milagre do novo nascimento",
  "carta aos efésios",
  "carta aos efesios"
];

function isProdutoAdvec50(titulo: string): boolean {
  const titleLower = titulo.toLowerCase();
  return PRODUTOS_ADVEC_50_TITULOS.some(termo => titleLower.includes(termo));
}

function isClienteAdvec(tipoCliente: string | null | undefined): boolean {
  if (!tipoCliente) return false;
  return tipoCliente.toUpperCase().includes("ADVEC");
}

function isClienteIgrejaCpfCnpj(tipoCliente: string | null | undefined): boolean {
  if (!tipoCliente) return false;
  const upper = tipoCliente.toUpperCase();
  return (
    (upper.includes("IGREJA") || upper.includes("CNPJ") || upper.includes("CPF")) &&
    !upper.includes("ADVEC")
  );
}

function isClienteRepresentante(tipoCliente: string | null | undefined): boolean {
  if (!tipoCliente) return false;
  return tipoCliente.toUpperCase() === "REPRESENTANTE";
}

function calcularDescontoSetup(valorTotal: number, onboardingConcluido: boolean): { percentual: number; faixa: string } {
  if (!onboardingConcluido) {
    return { percentual: 0, faixa: "" };
  }
  
  if (valorTotal >= 501) {
    return { percentual: 30, faixa: "Premium (30%)" };
  } else if (valorTotal >= 301) {
    return { percentual: 25, faixa: "Avançado (25%)" };
  } else if (valorTotal > 0) {
    return { percentual: 20, faixa: "Básico (20%)" };
  }
  
  return { percentual: 0, faixa: "" };
}

function calcularDescontoRevendedor(valorTotal: number): { faixa: string; desconto: number } {
  if (valorTotal >= 699.90) {
    return { faixa: 'Ouro (30%)', desconto: 30 };
  } else if (valorTotal >= 499.90) {
    return { faixa: 'Prata (25%)', desconto: 25 };
  } else if (valorTotal >= 299.90) {
    return { faixa: 'Bronze (20%)', desconto: 20 };
  }
  return { faixa: '', desconto: 0 };
}

/**
 * Calcula descontos por categoria para qualquer cliente com configuração
 */
function calcularDescontoPorCategoria(
  items: ItemCalculadora[],
  descontosPorCategoria: DescontosCategoriaRepresentante
): { total: number; descontoValor: number; descontoPercentualMedio: number } {
  let valorComDesconto = 0;
  let subtotal = 0;

  items.forEach(item => {
    const categoria = categorizarProduto(item.titulo);
    const percentual = descontosPorCategoria[categoria] || 0;
    const valorOriginal = item.preco_cheio * item.quantidade;
    const desconto = valorOriginal * (percentual / 100);
    const valorFinal = valorOriginal - desconto;

    subtotal += valorOriginal;
    valorComDesconto += valorFinal;
  });

  const descontoValor = subtotal - valorComDesconto;
  const descontoPercentualMedio = subtotal > 0 ? (descontoValor / subtotal) * 100 : 0;

  return {
    total: valorComDesconto,
    descontoValor,
    descontoPercentualMedio: Math.round(descontoPercentualMedio * 100) / 100,
  };
}

/**
 * Calcula descontos para produtos locais (não Shopify)
 */
export function calcularDescontosLocal(
  items: ItemCalculadora[],
  tipoCliente: string | null | undefined,
  onboardingConcluido: boolean,
  descontoVendedor: number = 0,
  descontosPorCategoria?: DescontosCategoriaRepresentante
): CalculoDescontoLocal {
  const subtotal = items.reduce((sum, item) => sum + (item.preco_cheio * item.quantidade), 0);
  
  // PRIORIDADE 1: Cliente com descontos por categoria configurados (qualquer tipo de cliente)
  if (descontosPorCategoria && Object.keys(descontosPorCategoria).length > 0) {
    const hasAnyDiscount = Object.values(descontosPorCategoria).some(v => v > 0);
    
    if (hasAnyDiscount) {
      const resultado = calcularDescontoPorCategoria(items, descontosPorCategoria);
      
      return {
        subtotal,
        descontoPercentual: resultado.descontoPercentualMedio,
        descontoValor: resultado.descontoValor,
        total: resultado.total,
        tipoDesconto: "categoria",
        faixa: `Por Categoria (${resultado.descontoPercentualMedio.toFixed(0)}%)`,
      };
    }
  }
  
  // PRIORIDADE 2: Desconto do Vendedor (somente se NÃO tiver desconto por categoria)
  if (descontoVendedor > 0) {
    const descontoValor = subtotal * (descontoVendedor / 100);
    
    return {
      subtotal,
      descontoPercentual: descontoVendedor,
      descontoValor,
      total: subtotal - descontoValor,
      tipoDesconto: "vendedor",
      faixa: `Vendedor (${descontoVendedor}%)`
    };
  }
  
  // PRIORIDADE 3: Cliente ADVEC
  if (isClienteAdvec(tipoCliente)) {
    let valorComDesconto = 0;
    
    items.forEach(item => {
      const isProdutoEspecial = isProdutoAdvec50(item.titulo);
      const percentual = isProdutoEspecial ? 50 : 40;
      valorComDesconto += (item.preco_cheio * (1 - percentual / 100)) * item.quantidade;
    });
    
    const descontoValor = subtotal - valorComDesconto;
    const descontoPercentual = subtotal > 0 ? (descontoValor / subtotal) * 100 : 0;
    
    return {
      subtotal,
      descontoPercentual: Math.round(descontoPercentual * 100) / 100,
      descontoValor,
      total: valorComDesconto,
      tipoDesconto: "advec",
      faixa: `ADVEC (${Math.round(descontoPercentual)}%)`
    };
  }
  
  // PRIORIDADE 4: Cliente Igreja CPF/CNPJ com Setup concluído
  if (isClienteIgrejaCpfCnpj(tipoCliente) && onboardingConcluido) {
    const { percentual, faixa } = calcularDescontoSetup(subtotal, onboardingConcluido);
    const descontoValor = subtotal * (percentual / 100);
    
    return {
      subtotal,
      descontoPercentual: percentual,
      descontoValor,
      total: subtotal - descontoValor,
      tipoDesconto: "setup",
      faixa
    };
  }
  
  // PRIORIDADE 5: Revendedor
  if (tipoCliente?.toUpperCase() === "REVENDEDOR") {
    const { faixa, desconto } = calcularDescontoRevendedor(subtotal);
    const descontoValor = subtotal * (desconto / 100);
    
    return {
      subtotal,
      descontoPercentual: desconto,
      descontoValor,
      total: subtotal - descontoValor,
      tipoDesconto: "revendedor",
      faixa
    };
  }
  
  // Sem desconto
  return {
    subtotal,
    descontoPercentual: 0,
    descontoValor: 0,
    total: subtotal,
    tipoDesconto: "nenhum",
    faixa: ""
  };
}
