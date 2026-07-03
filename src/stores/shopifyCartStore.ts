import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, createStorefrontCheckout } from '@/lib/shopify';

/**
 * Chave composta de linha do carrinho.
 * Uma variant pode aparecer múltiplas vezes se sair de depósitos diferentes.
 */
export const lineKey = (variantId: string, depositoId?: number | null): string =>
  `${variantId}__${depositoId ?? ''}`;

interface ShopifyCartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;

  // Actions
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number, depositoId?: number | null) => void;
  updateDeposito: (variantId: string, oldDepositoId: number | null | undefined, depositoId: number, depositoNome: string) => void;
  removeItem: (variantId: string, depositoId?: number | null) => void;
  clearCart: () => void;
  setCartId: (cartId: string) => void;
  setCheckoutUrl: (url: string) => void;
  setLoading: (loading: boolean) => void;
  createCheckout: () => Promise<void>;
}

export const useShopifyCartStore = create<ShopifyCartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,

      addItem: (item) => {
        const { items } = get();
        const key = lineKey(item.variantId, item.depositoId);
        const existingItem = items.find(
          (i) => lineKey(i.variantId, i.depositoId) === key,
        );

        if (existingItem) {
          set({
            items: items.map((i) =>
              lineKey(i.variantId, i.depositoId) === key
                ? { ...i, quantity: i.quantity + item.quantity }
                : i,
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      updateQuantity: (variantId, quantity, depositoId) => {
        if (quantity <= 0) {
          get().removeItem(variantId, depositoId);
          return;
        }
        const key = lineKey(variantId, depositoId);
        set({
          items: get().items.map((item) =>
            lineKey(item.variantId, item.depositoId) === key
              ? { ...item, quantity }
              : item,
          ),
        });
      },

      updateDeposito: (variantId, oldDepositoId, depositoId, depositoNome) => {
        const oldKey = lineKey(variantId, oldDepositoId ?? undefined);
        const newKey = lineKey(variantId, depositoId);
        const items = get().items;
        // Se já existe uma linha para o novo depósito, mescla quantidades e remove a antiga
        const existingNew = items.find((i) => lineKey(i.variantId, i.depositoId) === newKey);
        const target = items.find((i) => lineKey(i.variantId, i.depositoId) === oldKey);
        if (!target) return;
        if (existingNew && existingNew !== target) {
          set({
            items: items
              .filter((i) => lineKey(i.variantId, i.depositoId) !== oldKey)
              .map((i) =>
                lineKey(i.variantId, i.depositoId) === newKey
                  ? { ...i, quantity: i.quantity + target.quantity }
                  : i,
              ),
          });
        } else {
          set({
            items: items.map((i) =>
              lineKey(i.variantId, i.depositoId) === oldKey
                ? { ...i, depositoId, depositoNome }
                : i,
            ),
          });
        }
      },

      removeItem: (variantId, depositoId) => {
        const key = lineKey(variantId, depositoId);
        set({
          items: get().items.filter((item) => lineKey(item.variantId, item.depositoId) !== key),
        });
      },

      clearCart: () => {
        set({ items: [], cartId: null, checkoutUrl: null });
      },

      setCartId: (cartId) => set({ cartId }),
      setCheckoutUrl: (checkoutUrl) => set({ checkoutUrl }),
      setLoading: (isLoading) => set({ isLoading }),

      createCheckout: async () => {
        const { items, setLoading, setCheckoutUrl } = get();
        if (items.length === 0) return;

        setLoading(true);
        try {
          const checkoutUrl = await createStorefrontCheckout(items);
          setCheckoutUrl(checkoutUrl);
        } catch (error) {
          console.error('Failed to create checkout:', error);
          throw error;
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: 'shopify-ebd-cart',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
