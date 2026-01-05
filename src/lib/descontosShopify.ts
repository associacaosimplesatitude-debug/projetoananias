import { CartItem } from "@/lib/shopify";
import { categorizarProduto, getNomeCategoria, type CategoriaShopifyId } from "@/constants/categoriasShopify";

// IDs dos produtos com desconto ADVEC de 50%
const PRODUTOS_ADVEC_50_IDS = [
  "gid://shopify/Product/8053892432047", // O Evangelho De João - Milagre Do Novo Nascimento
  "gid://shopify/Product/8053891186863"  // Carta Aos Efésios
];

// Títulos para fallback (se ID não bater, verificar título)
const PRODUTOS_ADVEC_50_TITULOS = [
  "evangelho de joão",
  "evangelho de joao",
  "milagre do novo nascimento",
  "carta aos efésios",
  "carta aos efesios"
];

/**
 * Verifica se um produto é elegível para desconto ADVEC de 50%
 */
export function isProdutoAdvec50(productTitle: string, productId?: string): boolean {
  // Verificar por ID primeiro
  if (productId && PRODUTOS_ADVEC_50_IDS.includes(productId)) {
    return true;
  }
  
  // Fallback para título
  const titleLower = productTitle.toLowerCase();
  return PRODUTOS_ADVEC_50_TITULOS.some(termo => titleLower.includes(termo));
}

/**
 * Verifica se o cliente é ADVEC
 */
export function isClienteAdvec(tipoCliente: string | null | undefined): boolean {
  if (!tipoCliente) return false;
  return tipoCliente.toUpperCase().includes("ADVEC");
}

/**
 * Verifica se o cliente é Igreja CPF ou CNPJ (não ADVEC)
 */
export function isClienteIgrejaCpfCnpj(tipoCliente: string | null | undefined): boolean {
  if (!tipoCliente) return false;
  const upper = tipoCliente.toUpperCase();
  return (
    (upper.includes("IGREJA") || upper.includes("CNPJ") || upper.includes("CPF")) &&
    !upper.includes("ADVEC")
  );
}

/**
 * Verifica se o cliente é do tipo REPRESENTANTE
 */
export function isClienteRepresentante(tipoCliente: string | null | undefined): boolean {
  if (!tipoCliente) return false;
  return tipoCliente.toUpperCase() === "REPRESENTANTE";
}

/**
 * Calcula desconto progressivo do Setup para clientes CPF/CNPJ
 * R$0-300: 20% off
 * R$301-500: 25% off  
 * R$501+: 30% off
 */
export function calcularDescontoSetup(valorTotal: number, onboardingConcluido: boolean): { percentual: number; faixa: string } {
  if (!onboardingConcluido) {
    return { percentual: 0, faixa: "" };
  }
  
  if (valorTotal >= 501) {
    return { percentual: 30, faixa: "Premium" };
  } else if (valorTotal >= 301) {
    return { percentual: 25, faixa: "Avançado" };
  } else if (valorTotal > 0) {
    return { percentual: 20, faixa: "Básico" };
  }
  
  return { percentual: 0, faixa: "" };
}

/**
 * Calcula desconto escalonado para REVENDEDORES
 */
export function calcularDescontoRevendedor(valorTotal: number): { faixa: string; desconto: number } {
  if (valorTotal >= 699.90) {
    return { faixa: 'Ouro', desconto: 30 };
  } else if (valorTotal >= 499.90) {
    return { faixa: 'Prata', desconto: 25 };
  } else if (valorTotal >= 299.90) {
    return { faixa: 'Bronze', desconto: 20 };
  }
  return { faixa: '', desconto: 0 };
}

export interface DescontoCategoriaItem {
  titulo: string;
  categoria: string;
  categoriaLabel: string;
  percentual: number;
  valorOriginal: number;
  valorComDesconto: number;
  descontoValor: number;
}

export interface CalculoDesconto {
  subtotal: number;
  descontoPercentual: number;
  descontoValor: number;
  total: number;
  tipoDesconto: "advec_50" | "setup" | "revendedor" | "b2b" | "representante" | "nenhum";
  faixa: string;
  itensComDesconto50?: string[]; // Títulos dos produtos com 50% off (ADVEC)
  itensComDescontoCategoria?: DescontoCategoriaItem[]; // Detalhes por item (Representante)
}

export interface DescontosCategoriaRepresentante {
  [categoria: string]: number; // categoria -> percentual
}

/**
 * Calcula descontos por categoria para clientes de Representantes
 */
export function calcularDescontoRepresentante(
  items: CartItem[],
  descontosPorCategoria: DescontosCategoriaRepresentante
): { 
  total: number; 
  descontoValor: number; 
  descontoPercentualMedio: number;
  itensDetalhados: DescontoCategoriaItem[];
} {
  let valorComDesconto = 0;
  let subtotal = 0;
  const itensDetalhados: DescontoCategoriaItem[] = [];

  items.forEach(item => {
    const titulo = item.product.node.title;
    const categoria = categorizarProduto(titulo);
    const percentual = descontosPorCategoria[categoria] || 0;
    const precoUnitario = parseFloat(item.price.amount);
    const valorOriginal = precoUnitario * item.quantity;
    const desconto = valorOriginal * (percentual / 100);
    const valorFinal = valorOriginal - desconto;

    subtotal += valorOriginal;
    valorComDesconto += valorFinal;

    itensDetalhados.push({
      titulo,
      categoria,
      categoriaLabel: getNomeCategoria(categoria),
      percentual,
      valorOriginal,
      valorComDesconto: valorFinal,
      descontoValor: desconto,
    });
  });

  const descontoValor = subtotal - valorComDesconto;
  const descontoPercentualMedio = subtotal > 0 ? (descontoValor / subtotal) * 100 : 0;

  return {
    total: valorComDesconto,
    descontoValor,
    descontoPercentualMedio: Math.round(descontoPercentualMedio * 100) / 100,
    itensDetalhados,
  };
}

/**
 * Calcula todos os descontos aplicáveis ao carrinho
 */
export function calcularDescontosCarrinho(
  items: CartItem[],
  tipoCliente: string | null | undefined,
  onboardingConcluido: boolean,
  descontoB2B: number = 0,
  descontosPorCategoria?: DescontosCategoriaRepresentante
): CalculoDesconto {
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  
  // PRIORIDADE 1: Cliente de Representante com descontos por categoria
  // Estes descontos SUBSTITUEM todos os outros
  if (isClienteRepresentante(tipoCliente) && descontosPorCategoria && Object.keys(descontosPorCategoria).length > 0) {
    const hasAnyDiscount = Object.values(descontosPorCategoria).some(v => v > 0);
    
    if (hasAnyDiscount) {
      const resultado = calcularDescontoRepresentante(items, descontosPorCategoria);
      
      return {
        subtotal,
        descontoPercentual: resultado.descontoPercentualMedio,
        descontoValor: resultado.descontoValor,
        total: resultado.total,
        tipoDesconto: "representante",
        faixa: "Representante",
        itensComDescontoCategoria: resultado.itensDetalhados,
      };
    }
  }
  
  // Caso 2: Cliente ADVEC - 50% em livros específicos (não cumulativo)
  if (isClienteAdvec(tipoCliente)) {
    const itensAdvec50: string[] = [];
    let valorComDesconto = 0;
    
    items.forEach(item => {
      const isProdutoEspecial = isProdutoAdvec50(item.product.node.title, item.product.node.id);
      const precoUnitario = parseFloat(item.price.amount);
      const percentual = isProdutoEspecial ? 50 : 40;

      if (isProdutoEspecial) {
        itensAdvec50.push(item.product.node.title);
      }

      valorComDesconto += (precoUnitario * (1 - percentual / 100)) * item.quantity;
    });
    
    const descontoValor = subtotal - valorComDesconto;
    const descontoPercentual = subtotal > 0 ? (descontoValor / subtotal) * 100 : 0;
    
    return {
      subtotal,
      descontoPercentual: Math.round(descontoPercentual * 100) / 100,
      descontoValor,
      total: valorComDesconto,
      tipoDesconto: itensAdvec50.length > 0 ? "advec_50" : "nenhum",
      faixa: itensAdvec50.length > 0 ? "ADVEC 50%" : "",
      itensComDesconto50: itensAdvec50
    };
  }
  
  // Caso 3: Cliente Igreja CPF/CNPJ com Setup concluído - Desconto progressivo
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
  
  // Caso 4: Revendedor - Desconto escalonado
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
  
  // Caso 5: Desconto B2B (faturamento)
  if (descontoB2B > 0) {
    const descontoValor = subtotal * (descontoB2B / 100);
    
    return {
      subtotal,
      descontoPercentual: descontoB2B,
      descontoValor,
      total: subtotal - descontoValor,
      tipoDesconto: "b2b",
      faixa: "B2B"
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
