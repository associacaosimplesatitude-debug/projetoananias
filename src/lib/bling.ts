import { supabase } from "@/integrations/supabase/client";

/**
 * Catálogo do PDV do vendedor agora vem do Bling (Shopify foi descontinuada).
 *
 * Esta lib chama as Edge Functions:
 *   - `bling-search-product` → lista de produtos ativos do Bling
 *   - `bling-check-stock`    → saldo consolidado de todos os depósitos
 *
 * Cada Edge Function gerencia internamente o token ativo da empresa
 * (Geral / PE / Penha) via `bling-callback*`.
 */

export interface BlingVariant {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
  sku: string;
  stockTotal: number;
}

export interface BlingProduct {
  id: string;
  title: string;
  images: { url: string }[];
  variants: BlingVariant[];
}

interface BlingSearchProduct {
  id: number | string;
  codigo?: string;
  nome?: string;
  preco?: number | string;
  imagemURL?: string;
  descricao?: string;
  estoque?: number;
  tipo?: string;
}

interface BlingSearchResponse {
  success: boolean;
  products?: BlingSearchProduct[];
  error?: string;
}

interface BlingStockItem {
  bling_produto_id: number | string;
  estoque_disponivel?: number;
  tem_estoque?: boolean;
}

interface BlingStockResponse {
  success: boolean;
  produtos?: BlingStockItem[];
  error?: string;
}

/**
 * Busca produtos no Bling e enriquece cada um com o saldo total
 * consolidado (soma de todos os depósitos retornados pela Edge Function
 * `bling-check-stock`).
 *
 * @param query Termo de busca (nome ou SKU). Se vazio/curto, retorna [].
 */
export async function fetchBlingProducts(query?: string): Promise<BlingProduct[]> {
  const term = (query ?? "").trim();

  // `bling-search-product` exige no mínimo 2 caracteres.
  if (term.length < 2) {
    return [];
  }

  const { data: searchData, error: searchError } = await supabase.functions.invoke<BlingSearchResponse>(
    "bling-search-product",
    { body: { query: term } }
  );

  if (searchError) {
    console.error("[fetchBlingProducts] erro em bling-search-product:", searchError);
    throw new Error(searchError.message || "Falha ao buscar produtos no Bling");
  }

  if (!searchData?.success || !Array.isArray(searchData.products)) {
    return [];
  }

  const rawProducts = searchData.products;

  // Para cada produto, consulta saldo consolidado.
  // Tolerante a falhas: se o estoque falhar para um SKU, marca como
  // indisponível mas mantém o restante da lista.
  const enriched = await Promise.all(
    rawProducts.map(async (p): Promise<BlingProduct> => {
      const sku = String(p.codigo ?? p.id ?? "");
      const blingProdutoId = p.id;
      const title = p.nome ?? sku;
      const priceNumber =
        typeof p.preco === "number" ? p.preco : parseFloat(String(p.preco ?? "0")) || 0;
      const price = priceNumber.toFixed(2);
      const imageUrl = p.imagemURL?.trim();

      let stockTotal = 0;
      try {
        const { data: stockData, error: stockError } = await supabase.functions.invoke<BlingStockResponse>(
          "bling-check-stock",
          {
            body: {
              produtos: [
                {
                  bling_produto_id: blingProdutoId,
                  quantidade: 1,
                  titulo: title,
                },
              ],
            },
          }
        );

        if (stockError) throw stockError;

        if (stockData?.success && Array.isArray(stockData.produtos) && stockData.produtos.length > 0) {
          stockTotal = Number(stockData.produtos[0].estoque_disponivel ?? 0) || 0;
        } else if (typeof p.estoque === "number") {
          // Fallback para o saldo já retornado pelo search-product.
          stockTotal = p.estoque;
        }
      } catch (err) {
        console.warn(`[fetchBlingProducts] estoque indisponível para SKU ${sku}:`, err);
        stockTotal = 0;
      }

      const availableForSale = stockTotal > 0;

      return {
        id: sku,
        title,
        images: imageUrl ? [{ url: imageUrl }] : [],
        variants: [
          {
            id: sku,
            title: "Único",
            price,
            availableForSale,
            sku,
            stockTotal,
          },
        ],
      };
    })
  );

  return enriched;
}
