import { create } from "zustand";
import type { Selections, TagSelection, FaceVisibilityOptions } from "@sd-prompt/shared";
import { createEmptySelections } from "@sd-prompt/shared";

// Categories to reset when navigating to a new image (even with carry-over)
const RESET_ON_IMAGE_CHANGE: (keyof Selections)[] = [
  "expression",
  "mouth",
  "pose_head",
  "pose_hand_head",
  "pose_hand_body",
  "pose_hand_torso",
  "pose_hand_prop",
  "pose_fingers",
  "pose_legs",
  "pose_static_upper",
  "pose_standing",
  "pose_sitting",
  "pose_lying",
  "pose_dynamic",
];

// Mouth open/close mutual exclusion pairs
const MOUTH_EXCLUSION: Record<string, string> = {
  open_mouth: "closed_mouth",
  closed_mouth: "open_mouth",
};

function createPartialResetSelections(current: Selections): Selections {
  const reset = createEmptySelections();
  const result = { ...current };
  for (const key of RESET_ON_IMAGE_CHANGE) {
    (result as any)[key] = (reset as any)[key];
  }
  return result;
}

interface CharacterState {
  selections: Selections;
  freeText: string;
  propsEnabled: boolean;
  propsText: string;
  accessoriesText: string;
  poseFreeText: string;
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
  poseFreeText: string;
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
  setPoseFreeText: (text: string) => void;

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
  poseFreeText: "",
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
        poseFreeText: state.poseFreeText,
        faceVisibilityOptions: state.faceVisibilityOptions,
      };
    }

    // Restore saved state for new character, or use empty
    const saved = newSavedStates[charId];
    if (saved) {
      // Migrate gaze from string to TagSelection[] if needed
      if (saved.selections.gaze && !Array.isArray(saved.selections.gaze)) {
        saved.selections.gaze = [];
      }
      set({
        activeCharacterId: charId,
        activeOutfitId: outfitId,
        selections: saved.selections,
        freeText: saved.freeText,
        propsEnabled: saved.propsEnabled,
        propsText: saved.propsText,
        accessoriesText: saved.accessoriesText,
        poseFreeText: saved.poseFreeText,
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
        poseFreeText: "",
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

      let newCurrent = [...current, tag];

      // Mouth open/close mutual exclusion
      if (categoryId === "mouth" && MOUTH_EXCLUSION[tag.tag_id]) {
        const exclude = MOUTH_EXCLUSION[tag.tag_id];
        newCurrent = newCurrent.filter((t) => t.tag_id !== exclude);
      }

      return {
        selections: {
          ...state.selections,
          [categoryId]: newCurrent,
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
  setPoseFreeText: (text) => set({ poseFreeText: text }),

  setImagePaths: (paths) => set({ imagePaths: paths, currentImageIndex: 0 }),

  goToImage: (index) => set({ currentImageIndex: index }),

  nextImage: (carryOver) => {
    const { currentImageIndex, imagePaths, selections } = get();
    if (currentImageIndex >= imagePaths.length - 1) return;
    if (!carryOver) {
      set({
        currentImageIndex: currentImageIndex + 1,
        selections: createEmptySelections(),
        freeText: "",
        propsEnabled: false,
        propsText: "",
        accessoriesText: "",
        poseFreeText: "",
        faceVisibilityOptions: {
          face_out_of_frame: false,
          head_out_of_frame: false,
          remove_hair: false,
        },
      });
    } else {
      // Carry over but reset expression, mouth, and pose tags (keep poseFreeText)
      set({
        currentImageIndex: currentImageIndex + 1,
        selections: createPartialResetSelections(selections),
      });
    }
  },

  prevImage: (carryOver) => {
    const { currentImageIndex, selections } = get();
    if (currentImageIndex <= 0) return;
    if (!carryOver) {
      set({
        currentImageIndex: currentImageIndex - 1,
        selections: createEmptySelections(),
        freeText: "",
        propsEnabled: false,
        propsText: "",
        accessoriesText: "",
        poseFreeText: "",
        faceVisibilityOptions: {
          face_out_of_frame: false,
          head_out_of_frame: false,
          remove_hair: false,
        },
      });
    } else {
      set({
        currentImageIndex: currentImageIndex - 1,
        selections: createPartialResetSelections(selections),
      });
    }
  },

  reset: () =>
    set({
      selections: createEmptySelections(),
      freeText: "",
      poseFreeText: "",
      faceVisibilityOptions: {
        face_out_of_frame: false,
        head_out_of_frame: false,
        remove_hair: false,
      },
    }),
}));
