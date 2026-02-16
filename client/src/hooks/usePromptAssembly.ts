import { useMemo } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useTagStore } from "@/stores/tagStore";
import { buildPrompt, type PromptResult } from "@sd-prompt/shared";
import { collectActiveRules, getDisabledCategories } from "@sd-prompt/shared";

export function usePromptAssembly(): {
  prompt: PromptResult | null;
  activeRules: string[];
  disabledCategories: Set<string>;
} {
  const { activeCharacterId, activeOutfitId, selections, freeText, propsEnabled, propsText, accessoriesText, faceVisibilityOptions } =
    usePromptStore();
  const characters = useCharacterStore((s) => s.characters);
  const tagDb = useTagStore((s) => s.tagDb);

  return useMemo(() => {
    if (!activeCharacterId || !activeOutfitId) {
      return { prompt: null, activeRules: [], disabledCategories: new Set() };
    }

    const character = characters.find((c) => c.id === activeCharacterId);
    if (!character) {
      return { prompt: null, activeRules: [], disabledCategories: new Set() };
    }

    const outfit = character.outfits.find((o) => o.id === activeOutfitId);
    if (!outfit) {
      return { prompt: null, activeRules: [], disabledCategories: new Set() };
    }

    const activeRules = collectActiveRules(selections, tagDb, faceVisibilityOptions);
    const disabledCategories = getDisabledCategories(activeRules);
    const prompt = buildPrompt(outfit, selections, tagDb, freeText, faceVisibilityOptions, propsEnabled ? propsText : "", accessoriesText);

    return { prompt, activeRules, disabledCategories };
  }, [activeCharacterId, activeOutfitId, selections, freeText, propsEnabled, propsText, accessoriesText, faceVisibilityOptions, characters, tagDb]);
}
