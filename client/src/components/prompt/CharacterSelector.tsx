import { useMemo } from "react";
import { useCharacterStore } from "@/stores/characterStore";
import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/lib/utils";
import type { Character } from "@sd-prompt/shared";

export function CharacterSelector() {
  const characters = useCharacterStore((s) => s.characters);
  const { activeCharacterId, activeOutfitId, setCharacter, setOutfit } = usePromptStore();

  const activeChar = characters.find((c) => c.id === activeCharacterId);

  // Group characters by their group field (e.g. "神様のかくしごと/メイン")
  const grouped = useMemo(() => {
    const map = new Map<string, Character[]>();
    for (const c of characters) {
      const group = c.group || "その他";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(c);
    }
    return map;
  }, [characters]);

  // Extract work name and role from group path (e.g. "神様のかくしごと/メイン" → work: "神様のかくしごと", role: "メイン")
  const workGroups = useMemo(() => {
    const works = new Map<string, { role: string; chars: Character[] }[]>();
    for (const [group, chars] of grouped) {
      const parts = group.split("/");
      const work = parts[0];
      const role = parts[1] || "";
      if (!works.has(work)) works.set(work, []);
      works.get(work)!.push({ role, chars });
    }
    return works;
  }, [grouped]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">キャラクター</label>

      {Array.from(workGroups.entries()).map(([work, roles]) => (
        <div key={work} className="space-y-1">
          {/* Work title (only show if more than 1 work) */}
          {workGroups.size > 1 && (
            <div className="text-[10px] font-medium text-muted-foreground">{work}</div>
          )}

          {roles.map(({ role, chars }) => (
            <div key={role} className="space-y-1">
              {/* Role label */}
              {role && (
                <div className="text-[10px] text-muted-foreground/70 pl-0.5">{role}</div>
              )}
              <div className="flex flex-wrap gap-1">
                {chars.map((char) => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => setCharacter(char.id, char.outfits[0]?.id || "")}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer",
                      activeCharacterId === char.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    )}
                  >
                    {char.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {characters.length === 0 && (
        <span className="text-xs text-muted-foreground">
          キャラクターを先に登録してください
        </span>
      )}

      {/* Outfit buttons */}
      {activeChar && activeChar.outfits.length > 1 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">衣装</label>
          <div className="flex flex-wrap gap-1">
            {activeChar.outfits.map((outfit) => (
              <button
                key={outfit.id}
                type="button"
                onClick={() => setOutfit(outfit.id)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer",
                  activeOutfitId === outfit.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                )}
              >
                {outfit.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
