import { Textarea } from "@/components/ui/textarea";
import { usePromptStore } from "@/stores/promptStore";

export function FreeTextInput() {
  const freeText = usePromptStore((s) => s.freeText);
  const setFreeText = usePromptStore((s) => s.setFreeText);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        自由記入欄（ブロック3末尾に追加）
      </label>
      <Textarea
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        placeholder="wind effect, sparkle など"
        rows={2}
        className="text-sm"
      />
    </div>
  );
}
