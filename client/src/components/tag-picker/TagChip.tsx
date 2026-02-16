import { cn } from "@/lib/utils";
import { Star, X } from "lucide-react";

interface TagChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  favorite?: boolean;
  weight?: number;
  onClick?: () => void;
  onRemove?: () => void;
  onToggleFavorite?: () => void;
}

export function TagChip({
  label,
  selected,
  disabled,
  favorite,
  weight,
  onClick,
  onRemove,
  onToggleFavorite,
}: TagChipProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onContextMenu={
        onToggleFavorite
          ? (e) => {
              e.preventDefault();
              onToggleFavorite();
            }
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all border cursor-pointer select-none",
        disabled && "opacity-40 cursor-not-allowed",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-accent"
      )}
    >
      {favorite && <Star className="h-3 w-3 fill-current" />}
      {label}
      {weight !== undefined && weight !== 1.0 && (
        <span className="text-[10px] opacity-75">({weight.toFixed(2)})</span>
      )}
      {onRemove && selected && (
        <X
          className="h-3 w-3 ml-0.5 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </button>
  );
}
