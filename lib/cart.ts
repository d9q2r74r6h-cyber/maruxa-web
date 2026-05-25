import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  id: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  tamano?: string;
  cantidad: number;
};

type CartStore = {
  items: CartItem[];

  addItem: (item: CartItem) => void;
  removeItem: (id: number, tamano?: string) => void;
  clearCart: () => void;
  increase: (id: number, tamano?: string) => void;
  decrease: (id: number, tamano?: string) => void;
};

export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.id === item.id && i.tamano === item.tamano
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id && i.tamano === item.tamano
                  ? { ...i, cantidad: i.cantidad + 1 }
                  : i
              ),
            };
          }

          return {
            items: [...state.items, item],
          };
        }),

      removeItem: (id, tamano) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.id === id && i.tamano === tamano)
          ),
        })),

      clearCart: () =>
        set({
          items: [],
        }),

      increase: (id, tamano) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id && i.tamano === tamano
              ? { ...i, cantidad: i.cantidad + 1 }
              : i
          ),
        })),

      decrease: (id, tamano) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.id === id && i.tamano === tamano
                ? { ...i, cantidad: i.cantidad - 1 }
                : i
            )
            .filter((i) => i.cantidad > 0),
        })),
    }),
    {
      name: 'maruxa-cart',
    }
  )
);