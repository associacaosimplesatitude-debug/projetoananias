// Categorias de produtos do catálogo Shopify
export const CATEGORIAS_SHOPIFY = [
  { id: 'revistas', name: 'Revistas EBD' },
  { id: 'biblias', name: 'Bíblias' },
  { id: 'livros', name: 'Livros e Devocionais' },
  { id: 'infantil', name: 'Infantil' },
  { id: 'perfumes', name: 'Perfumes' },
  { id: 'outros', name: 'Outros Produtos' },
] as const;

export type CategoriaShopifyId = typeof CATEGORIAS_SHOPIFY[number]['id'];

// Interface para desconto por categoria
export interface DescontoCategoria {
  categoria: CategoriaShopifyId;
  percentual_desconto: number;
}

// Função para obter o nome da categoria pelo ID
export function getNomeCategoria(categoriaId: string): string {
  const categoria = CATEGORIAS_SHOPIFY.find(c => c.id === categoriaId);
  return categoria?.name || categoriaId;
}

// Função para categorizar produto baseado no título (mesmo padrão do ShopifyPedidos)
export function categorizarProduto(title: string): CategoriaShopifyId {
  const lowerTitle = title.toLowerCase();
  
  // Revistas EBD
  const isRevista = lowerTitle.includes('revista') || 
                    lowerTitle.includes('ebd') || 
                    lowerTitle.includes('estudo bíblico') || 
                    lowerTitle.includes('estudo biblico') ||
                    lowerTitle.includes('kit do professor') ||
                    lowerTitle.includes('kit professor') ||
                    lowerTitle.includes('infografico');
  
  if (isRevista) return 'revistas';
  
  // Bíblias
  if (lowerTitle.includes('bíblia') || lowerTitle.includes('biblia')) {
    return 'biblias';
  }
  
  // Perfumes
  if (lowerTitle.includes('perfume') || lowerTitle.includes('fragrância') || lowerTitle.includes('fragrancia')) {
    return 'perfumes';
  }
  
  // Infantil
  if (lowerTitle.includes('infantil') || lowerTitle.includes('criança') || lowerTitle.includes('crianca') ||
      lowerTitle.includes('kids') || lowerTitle.includes('colorir')) {
    return 'infantil';
  }
  
  // Livros e Devocionais
  if (lowerTitle.includes('livro') || lowerTitle.includes('devocional') || 
      lowerTitle.includes('comentário') || lowerTitle.includes('comentario')) {
    return 'livros';
  }
  
  return 'outros';
}
