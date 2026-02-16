import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DenoisingSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const PRESETS = [0.5, 0.55, 0.6, 0.65, 0.7];

export function DenoisingSlider({ value, onChange }: DenoisingSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground shrink-0">
        Denoising
      </label>
      <div className="flex gap-0.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "px-1.5 py-0.5 text-[10px] rounded border transition-colors",
              Math.abs(value - p) < 0.001
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {p.toFixed(2)}
          </button>
        ))}
      </div>
      <Slider
        value={value}
        min={0.0}
        max={1.0}
        step={0.05}
        onChange={onChange}
        className="flex-1 min-w-[60px]"
      />
      <Input
        type="number"
        value={value}
        min={0.0}
        max={1.0}
        step={0.05}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0 && v <= 1) onChange(v);
        }}
        className="w-14 h-6 text-[10px] text-center"
      />
    </div>
  );
}

interface BatchCountControlProps {
  value: number;
  onChange: (value: number) => void;
}

const BATCH_PRESETS = [1, 3, 5, 7, 8, 10];

export function BatchCountControl({ value, onChange }: BatchCountControlProps) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        生成枚数
      </label>
      <div className="flex items-center gap-1">
        {BATCH_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "px-2.5 py-0.5 text-[11px] rounded border transition-colors",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {n}枚
          </button>
        ))}
        <Input
          type="number"
          value={value}
          min={1}
          max={20}
          step={1}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= 20) onChange(v);
          }}
          className="w-16 h-7 text-[11px] text-center ml-1"
        />
      </div>
    </div>
  );
}
