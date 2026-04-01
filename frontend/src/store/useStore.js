import { create } from "zustand";

export const useStore = create((set) => ({
  user: null,
  cartCount: 0,
  wishlistCount: 0,
  searchHistory: [],
  flyToCart: null,
  toast: null,

  setUser: (user) => set({ user }),
  setCounts: (cartCount, wishlistCount) => set({ cartCount, wishlistCount }),
  setSearchHistory: (searchHistory) => set({ searchHistory }),

  // ✅ Tăng cartCount realtime khi thêm vào giỏ
  increaseCartCount: () => set((state) => ({ cartCount: state.cartCount + 1 })),

  triggerFlyToCart: (flyToCart) => {
    set({ flyToCart });
    setTimeout(() => set({ flyToCart: null }), 700);
  },
  notify: (message, type = "success") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 2200);
  },
}));