import { create } from "zustand";
import { api } from "@/lib/api";
import type { AppSettings } from "@sd-prompt/shared";

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  fetch: () => Promise<void>;
  update: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const settings = await api.getSettings();
    set({ settings, loading: false });
  },

  update: async (partial) => {
    const current = get().settings;
    if (!current) return;
    const updated = await api.updateSettings(partial);
    set({ settings: updated });
  },
}));
