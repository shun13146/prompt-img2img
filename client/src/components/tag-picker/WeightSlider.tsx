import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface WeightSliderProps {
  tagLabel: string;
  weight: number;
  onChange: (weight: number) => void;
  onRemove: () => void;
}

export function WeightSlider({ tagLabel, weight, onChange, onRemove }: WeightSliderProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-medium min-w-[80px] truncate">{tagLabel}</span>
      <Slider
        value={weight}
        min={0.1}
        max={2.0}
        step={0.05}
        onChange={onChange}
        className="flex-1"
      />
      <Input
        type="number"
        value={weight}
        min={0.1}
        max={2.0}
        step={0.05}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0.1 && v <= 2.0) onChange(v);
        }}
        className="w-16 h-7 text-xs text-center"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive text-xs cursor-pointer"
      >
        x
      </button>
    </div>
  );
}
