import { useMemo } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { useTagStore } from "@/stores/tagStore";
import type { PromptResult, TagSelection } from "@sd-prompt/shared";

interface PromptPreviewProps {
  prompt: PromptResult | null;
}

export function PromptPreview({ prompt }: PromptPreviewProps) {
  if (!prompt) {
    return (
      <div className="border rounded-lg p-4 text-sm text-muted-foreground">
        キャラクターを選択するとプロンプトが表示されます
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Block structure view */}
      <div className="border rounded-lg overflow-hidden text-sm font-mono">
        <Block label="ブロック3（タグ）" content={prompt.block3} />
        <BreakSeparator />
        <Block label="ブロック1（品質）" content={prompt.block1} />
        <BreakSeparator />
        <Block label="ブロック2（キャラ）" content={prompt.block2} />
      </div>

      {/* Category breakdown */}
      <SelectionSummary />
    </div>
  );
}

/** Category-based selection summary */
function SelectionSummary() {
  const { selections } = usePromptStore();
  const tagDb = useTagStore((s) => s.tagDb);

  const entries = useMemo(() => {
    const result: { label: string; value: string }[] = [];

    for (const cat of tagDb.categories) {
      if (cat.type === "single") {
        const selectedId = selections[cat.id] as string | null;
        if (!selectedId) continue;
        const opt = cat.options?.find((o) => o.id === selectedId);
        if (opt) result.push({ label: cat.label, value: opt.label });
      } else {
        const tags = selections[cat.id] as TagSelection[] | undefined;
        if (!tags || !Array.isArray(tags) || tags.length === 0) continue;
        const formatted = tags.map((t) => {
          const entry = cat.subcategories
            ?.flatMap((s) => s.tags)
            .find((e) => e.id === t.tag_id);
          const label = entry?.label || t.prompt;
          return t.weight !== 1.0 ? `${label}(${t.weight.toFixed(2)})` : label;
        });
        result.push({ label: cat.label, value: formatted.join(", ") });
      }
    }

    return result;
  }, [selections, tagDb]);

  if (entries.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="text-[10px] font-medium text-muted-foreground mb-1">選択中のタグ</div>
      {entries.map((e) => (
        <div key={e.label} className="flex gap-2 text-xs">
          <span className="text-muted-foreground shrink-0 w-28 text-right">{e.label}:</span>
          <span className="font-medium">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

function Block({ label, content }: { label: string; content: string }) {
  return (
    <div className="p-3">
      <div className="text-[10px] text-muted-foreground font-sans mb-1">{label}</div>
      <div className="text-xs leading-relaxed break-all whitespace-pre-wrap">
        {content || <span className="text-muted-foreground italic">(empty)</span>}
      </div>
    </div>
  );
}

function BreakSeparator() {
  return (
    <div className="bg-muted px-3 py-0.5 text-[10px] font-medium text-muted-foreground text-center">
      BREAK
    </div>
  );
}
