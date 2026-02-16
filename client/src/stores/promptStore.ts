import { create } from "zustand";
import type { Selections, TagSelection, FaceVisibilityOptions } from "@sd-prompt/shared";
import { createEmptySelections } from "@sd-prompt/shared";

interface CharacterState {
  selections: Selections;
  freeText: string;
  propsEnabled: boolean;
  propsText: string;
  accessoriesText: string;
  faceVisibilityOptions: FaceVisibilityOptions;
}

interface PromptState {
  // Current session
  activeCharacterId: string | null;
  activeOutfitId: string | null;
  selections: Selections;
  freeText: string;
  propsEnabled: boolean;
  propsText: string;
  accessoriesText: string;
  faceVisibilityOptions: FaceVisibilityOptions;

  // Per-character saved state
  savedStates: Record<string, CharacterState>;

  // Image navigation (Mode A)
  imagePaths: string[];
  currentImageIndex: number;

  // Actions
  setCharacter: (charId: string, outfitId: string) => void;
  setOutfit: (outfitId: string) => void;

  // Single-select actions
  setSingleSelect: (categoryId: string, optionId: string | null) => void;

  // Multi-select actions
  addTag: (categoryId: string, tag: TagSelection) => void;
  removeTag: (categoryId: string, tagId: string) => void;
  setTagWeight: (categoryId: string, tagId: string, weight: number) => void;

  // Face visibility options
  setFaceVisibilityOption: (key: keyof FaceVisibilityOptions, value: boolean) => void;

  // Free text
  setFreeText: (text: string) => void;
  setPropsEnabled: (enabled: boolean) => void;
  setPropsText: (text: string) => void;
  setAccessoriesText: (text: string) => void;

  // Navigation
  setImagePaths: (paths: string[]) => void;
  goToImage: (index: number) => void;
  nextImage: (carryOver: boolean) => void;
  prevImage: (carryOver: boolean) => void;

  // Reset
  reset: () => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  activeCharacterId: null,
  activeOutfitId: null,
  selections: createEmptySelections(),
  freeText: "",
  propsEnabled: false,
  propsText: "",
  accessoriesText: "",
  faceVisibilityOptions: {
    face_out_of_frame: false,
    head_out_of_frame: false,
    remove_hair: false,
  },
  savedStates: {},
  imagePaths: [],
  currentImageIndex: 0,

  setCharacter: (charId, outfitId) => {
    const state = get();
    const newSavedStates = { ...state.savedStates };

    // Save current character's state
    if (state.activeCharacterId) {
      newSavedStates[state.activeCharacterId] = {
        selections: state.selections,
        freeText: state.freeText,
        propsEnabled: state.propsEnabled,
        propsText: state.propsText,
        accessoriesText: state.accessoriesText,
        faceVisibilityOptions: state.faceVisibilityOptions,
      };
    }

    // Restore saved state for new character, or use empty
    const saved = newSavedStates[charId];
    if (saved) {
      set({
        activeCharacterId: charId,
        activeOutfitId: outfitId,
        selections: saved.selections,
        freeText: saved.freeText,
        propsEnabled: saved.propsEnabled,
        propsText: saved.propsText,
        accessoriesText: saved.accessoriesText,
        faceVisibilityOptions: saved.faceVisibilityOptions,
        savedStates: newSavedStates,
      });
    } else {
      set({
        activeCharacterId: charId,
        activeOutfitId: outfitId,
        selections: createEmptySelections(),
        freeText: "",
        propsEnabled: false,
        propsText: "",
        accessoriesText: "",
        faceVisibilityOptions: {
          face_out_of_frame: false,
          head_out_of_frame: false,
          remove_hair: false,
        },
        savedStates: newSavedStates,
      });
    }
  },

  setOutfit: (outfitId) => {
    set({ activeOutfitId: outfitId });
  },

  setSingleSelect: (categoryId, optionId) => {
    set((state) => ({
      selections: { ...state.selections, [categoryId]: optionId },
    }));
  },

  addTag: (categoryId, tag) => {
    set((state) => {
      const current = state.selections[categoryId];
      if (!Array.isArray(current)) return state;
      // Avoid duplicates
      if (current.some((t) => t.tag_id === tag.tag_id)) return state;
      return {
        selections: {
          ...state.selections,
          [categoryId]: [...current, tag],
        },
      };
    });
  },

  removeTag: (categoryId, tagId) => {
    set((state) => {
      const current = state.selections[categoryId];
      if (!Array.isArray(current)) return state;
      return {
        selections: {
          ...state.selections,
          [categoryId]: current.filter((t) => t.tag_id !== tagId),
        },
      };
    });
  },

  setTagWeight: (categoryId, tagId, weight) => {
    set((state) => {
      const current = state.selections[categoryId];
      if (!Array.isArray(current)) return state;
      return {
        selections: {
          ...state.selections,
          [categoryId]: current.map((t) =>
            t.tag_id === tagId ? { ...t, weight } : t
          ),
        },
      };
    });
  },

  setFaceVisibilityOption: (key, value) => {
    set((state) => ({
      faceVisibilityOptions: { ...state.faceVisibilityOptions, [key]: value },
    }));
  },

  setFreeText: (text) => set({ freeText: text }),
  setPropsEnabled: (enabled) => set({ propsEnabled: enabled }),
  setPropsText: (text) => set({ propsText: text }),
  setAccessoriesText: (text) => set({ accessoriesText: text }),

  setImagePaths: (paths) => set({ imagePaths: paths, currentImageIndex: 0 }),

  goToImage: (index) => set({ currentImageIndex: index }),

  nextImage: (carryOver) => {
    const { currentImageIndex, imagePaths } = get();
    if (currentImageIndex >= imagePaths.length - 1) return;
    if (!carryOver) {
      set({
        currentImageIndex: currentImageIndex + 1,
        selections: createEmptySelections(),
        freeText: "",
        propsEnabled: false,
        propsText: "",
        accessoriesText: "",
        faceVisibilityOptions: {
          face_out_of_frame: false,
          head_out_of_frame: false,
          remove_hair: false,
        },
      });
    } else {
      set({ currentImageIndex: currentImageIndex + 1 });
    }
  },

  prevImage: (carryOver) => {
    const { currentImageIndex } = get();
    if (currentImageIndex <= 0) return;
    if (!carryOver) {
      set({
        currentImageIndex: currentImageIndex - 1,
        selections: createEmptySelections(),
        freeText: "",
        propsEnabled: false,
        propsText: "",
        accessoriesText: "",
        faceVisibilityOptions: {
          face_out_of_frame: false,
          head_out_of_frame: false,
          remove_hair: false,
        },
      });
    } else {
      set({ currentImageIndex: currentImageIndex - 1 });
    }
  },

  reset: () =>
    set({
      selections: createEmptySelections(),
      freeText: "",
      faceVisibilityOptions: {
        face_out_of_frame: false,
        head_out_of_frame: false,
        remove_hair: false,
      },
    }),
}));
