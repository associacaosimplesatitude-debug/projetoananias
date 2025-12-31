import { CartItem } from "@/lib/shopify";

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

export interface CalculoDesconto {
  subtotal: number;
  descontoPercentual: number;
  descontoValor: number;
  total: number;
  tipoDesconto: "advec_50" | "setup" | "revendedor" | "b2b" | "nenhum";
  faixa: string;
  itensComDesconto50?: string[]; // Títulos dos produtos com 50% off (ADVEC)
}

/**
 * Calcula todos os descontos aplicáveis ao carrinho
 */
export function calcularDescontosCarrinho(
  items: CartItem[],
  tipoCliente: string | null | undefined,
  onboardingConcluido: boolean,
  descontoB2B: number = 0
): CalculoDesconto {
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  
  // Caso 1: Cliente ADVEC - 50% em livros específicos (não cumulativo)
  if (isClienteAdvec(tipoCliente)) {
    const itensAdvec50: string[] = [];
    let valorComDesconto = 0;
    
    items.forEach(item => {
      const isProdutoEspecial = isProdutoAdvec50(item.product.node.title, item.product.node.id);
      const precoUnitario = parseFloat(item.price.amount);
      
      if (isProdutoEspecial) {
        itensAdvec50.push(item.product.node.title);
        valorComDesconto += (precoUnitario * 0.5) * item.quantity; // 50% off
      } else {
        valorComDesconto += precoUnitario * item.quantity; // Preço normal
      }
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
  
  // Caso 2: Cliente Igreja CPF/CNPJ com Setup concluído - Desconto progressivo
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
  
  // Caso 3: Revendedor - Desconto escalonado
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
  
  // Caso 4: Desconto B2B (faturamento)
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
