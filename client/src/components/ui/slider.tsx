import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

function Slider({ value, min = 0, max = 100, step = 1, onChange, className }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={cn(
        "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary",
        className
      )}
    />
  );
}

export { Slider };
