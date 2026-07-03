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

export interface BlingSaldoDeposito {
  depositoId: number;
  nome: string;
  saldo: number;
}

export interface BlingVariant {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
  sku: string;
  stockTotal: number;
  saldosPorDeposito: BlingSaldoDeposito[];
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
  saldosPorDeposito?: BlingSaldoDeposito[];
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
  if (rawProducts.length === 0) return [];

  // Confia no estoque retornado pela busca (search-product já consolida
  // `saldoVirtualTotal`). Só dispara o `bling-check-stock` — em UMA chamada
  // batched — para os SKUs que vieram sem estoque, para confirmar antes de
  // marcar como indisponível.
  const stockMap = new Map<string, number>();
  const needCheck = rawProducts.filter((p) => !(typeof p.estoque === "number" && p.estoque > 0));

  if (needCheck.length > 0) {
    try {
      const { data: stockData, error: stockError } = await supabase.functions.invoke<BlingStockResponse>(
        "bling-check-stock",
        {
          body: {
            produtos: needCheck.map((p) => ({
              bling_produto_id: p.id,
              quantidade: 1,
              titulo: p.nome ?? String(p.codigo ?? p.id),
            })),
          },
        }
      );
      if (stockError) throw stockError;
      if (stockData?.success && Array.isArray(stockData.produtos)) {
        for (const item of stockData.produtos) {
          stockMap.set(String(item.bling_produto_id), Number(item.estoque_disponivel ?? 0) || 0);
        }
      }
    } catch (err) {
      console.warn("[fetchBlingProducts] estoque batched indisponível:", err);
    }
  }

  const mapped = rawProducts.map((p): BlingProduct => {
    const sku = String(p.codigo ?? p.id ?? "");
    const title = p.nome ?? sku;
    const priceNumber =
      typeof p.preco === "number" ? p.preco : parseFloat(String(p.preco ?? "0")) || 0;
    const price = priceNumber.toFixed(2);
    const imageUrl = p.imagemURL?.trim();

    const stockFromSearch = typeof p.estoque === "number" ? p.estoque : 0;
    const stockFromCheck = stockMap.get(String(p.id));
    const stockTotal = stockFromSearch > 0 ? stockFromSearch : (stockFromCheck ?? 0);
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
          saldosPorDeposito: Array.isArray(p.saldosPorDeposito) ? p.saldosPorDeposito : [],
        },
      ],
    };
  });

  // Dedupe por SKU: o Bling pode ter mais de um cadastro com o mesmo `codigo`
  // (IDs internos diferentes, geralmente um antigo e outro novo). Mostramos
  // apenas UM card no PDV, priorizando o de maior estoque e preservando a
  // imagem do outro cadastro se o vencedor não tiver.
  const bySku = new Map<string, BlingProduct>();
  for (const prod of mapped) {
    const key = prod.variants[0]?.sku || prod.id;
    if (!key) continue;
    const existing = bySku.get(key);
    if (!existing) {
      bySku.set(key, prod);
      continue;
    }
    const existingStock = existing.variants[0]?.stockTotal ?? 0;
    const currentStock = prod.variants[0]?.stockTotal ?? 0;
    const winner = currentStock > existingStock ? prod : existing;
    const loser = winner === prod ? existing : prod;
    if (winner.images.length === 0 && loser.images.length > 0) {
      winner.images = loser.images;
    }
    bySku.set(key, winner);
  }

  return Array.from(bySku.values());
}
