import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/lib/utils";

export function PropsInput() {
  const { propsEnabled, propsText, accessoriesText, setPropsEnabled, setPropsText, setAccessoriesText } = usePromptStore();

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
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground shrink-0">小物</label>
        <input
          type="text"
          value={accessoriesText}
          onChange={(e) => setAccessoriesText(e.target.value)}
          placeholder="画像にある小物をそのまま記入"
          className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
        />
      </div>
    </div>
  );
}
