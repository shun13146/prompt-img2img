import { create } from "zustand";
import { api } from "@/lib/api";
import type { Character } from "@sd-prompt/shared";

interface CharacterState {
  characters: Character[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (char: Character) => Promise<void>;
  update: (id: string, char: Character) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const characters = await api.getCharacters();
    set({ characters, loading: false });
  },

  create: async (char) => {
    await api.createCharacter(char);
    set({ characters: [...get().characters, char] });
  },

  update: async (id, char) => {
    await api.updateCharacter(id, char);
    set({
      characters: get().characters.map((c) => (c.id === id ? char : c)),
    });
  },

  remove: async (id) => {
    await api.deleteCharacter(id);
    set({ characters: get().characters.filter((c) => c.id !== id) });
  },
}));
