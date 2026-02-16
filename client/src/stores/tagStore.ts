import { create } from "zustand";
import { api } from "@/lib/api";
import type { TagDatabase } from "@sd-prompt/shared";

interface TagState {
  tagDb: TagDatabase;
  loading: boolean;
  fetch: () => Promise<void>;
  toggleFavorite: (categoryId: string, tagId: string, favorite: boolean) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tagDb: { categories: [] },
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const tagDb = await api.getTags();
    set({ tagDb, loading: false });
  },

  toggleFavorite: async (categoryId, tagId, favorite) => {
    await api.toggleFavorite(categoryId, tagId, favorite);
    // Update local state
    const tagDb = { ...get().tagDb };
    const cat = tagDb.categories.find((c) => c.id === categoryId);
    if (cat?.subcategories) {
      for (const sub of cat.subcategories) {
        const tag = sub.tags.find((t) => t.id === tagId);
        if (tag) {
          tag.favorite = favorite;
          break;
        }
      }
    }
    set({ tagDb });
  },
}));
