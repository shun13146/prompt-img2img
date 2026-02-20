import { useMemo } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useTagStore } from "@/stores/tagStore";
import { buildPrompt, type PromptResult } from "@sd-prompt/shared";
import { collectActiveRules, getDisabledCategories, getSuppressedCategories } from "@sd-prompt/shared";

export function usePromptAssembly(): {
  prompt: PromptResult | null;
  activeRules: string[];
  disabledCategories: Set<string>;
  suppressedCategories: Set<string>;
} {
  const activeCharacterId = usePromptStore((s) => s.activeCharacterId);
  const activeOutfitId = usePromptStore((s) => s.activeOutfitId);
  const selections = usePromptStore((s) => s.selections);
  const freeText = usePromptStore((s) => s.freeText);
  const propsEnabled = usePromptStore((s) => s.propsEnabled);
  const propsText = usePromptStore((s) => s.propsText);
  const accessoriesText = usePromptStore((s) => s.accessoriesText);
  const poseFreeText = usePromptStore((s) => s.poseFreeText);
  const faceVisibilityOptions = usePromptStore((s) => s.faceVisibilityOptions);
  const characters = useCharacterStore((s) => s.characters);
  const tagDb = useTagStore((s) => s.tagDb);

  return useMemo(() => {
    if (!activeCharacterId || !activeOutfitId) {
      return { prompt: null, activeRules: [], disabledCategories: new Set(), suppressedCategories: new Set() };
    }

    const character = characters.find((c) => c.id === activeCharacterId);
    if (!character) {
      return { prompt: null, activeRules: [], disabledCategories: new Set(), suppressedCategories: new Set() };
    }

    const outfit = character.outfits.find((o) => o.id === activeOutfitId);
    if (!outfit) {
      return { prompt: null, activeRules: [], disabledCategories: new Set(), suppressedCategories: new Set() };
    }

    const activeRules = collectActiveRules(selections, tagDb, faceVisibilityOptions);
    const disabledCategories = getDisabledCategories(activeRules);
    const suppressedCategories = getSuppressedCategories(selections, activeRules);
    const prompt = buildPrompt(outfit, selections, tagDb, freeText, faceVisibilityOptions, propsEnabled ? propsText : "", accessoriesText, poseFreeText);

    return { prompt, activeRules, disabledCategories, suppressedCategories };
  }, [activeCharacterId, activeOutfitId, selections, freeText, propsEnabled, propsText, accessoriesText, poseFreeText, faceVisibilityOptions, characters, tagDb]);
}
