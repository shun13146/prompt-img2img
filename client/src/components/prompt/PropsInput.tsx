import { useState, useRef } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/lib/utils";

// Session-level memory for accessories (persists during app session, not across restarts)
let accessoriesHistory: string[] = [];

export function PropsInput() {
  const propsEnabled = usePromptStore((s) => s.propsEnabled);
  const propsText = usePromptStore((s) => s.propsText);
  const accessoriesText = usePromptStore((s) => s.accessoriesText);
  const setPropsEnabled = usePromptStore((s) => s.setPropsEnabled);
  const setPropsText = usePromptStore((s) => s.setPropsText);
  const setAccessoriesText = usePromptStore((s) => s.setAccessoriesText);
  const [showHistory, setShowHistory] = useState(false);

  const handleAccessoriesBlur = () => {
    const trimmed = accessoriesText.trim();
    if (trimmed && !accessoriesHistory.includes(trimmed)) {
      accessoriesHistory = [trimmed, ...accessoriesHistory].slice(0, 20);
    }
  };

  const handleAccessoriesKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAccessoriesBlur();
    }
  };

  const handleSelectFromHistory = (text: string) => {
    setAccessoriesText(text);
    setShowHistory(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">持ち物</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPropsEnabled(false)}
            className={cn(
              "px-2 py-0.5 text-[11px] rounded border transition-colors cursor-pointer",
              !propsEnabled
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-accent"
            )}
          >
            なし
          </button>
          <button
            type="button"
            onClick={() => setPropsEnabled(true)}
            className={cn(
              "px-2 py-0.5 text-[11px] rounded border transition-colors cursor-pointer",
              propsEnabled
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-accent"
            )}
          >
            持つ
          </button>
        </div>
      </div>
      {propsEnabled && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground shrink-0">holding</span>
          <input
            type="text"
            value={propsText}
            onChange={(e) => setPropsText(e.target.value)}
            placeholder="book"
            className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
            autoFocus
          />
        </div>
      )}
      {/* Accessories free text */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <label className="text-xs text-muted-foreground shrink-0">小物</label>
          <input
            type="text"
            value={accessoriesText}
            onChange={(e) => setAccessoriesText(e.target.value)}
            onBlur={handleAccessoriesBlur}
            onKeyDown={handleAccessoriesKeyDown}
            placeholder="画像にある小物をそのまま記入"
            className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
          />
          {accessoriesHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="px-1.5 py-0.5 text-[10px] rounded border border-border text-muted-foreground hover:bg-accent transition-colors shrink-0"
              title="履歴"
            >
              履歴
            </button>
          )}
        </div>
        {showHistory && accessoriesHistory.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {accessoriesHistory.map((text, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectFromHistory(text)}
                className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/50 text-foreground hover:bg-accent transition-colors cursor-pointer truncate max-w-[200px]"
                title={text}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
