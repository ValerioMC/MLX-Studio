import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** One choice out of a few, shown side by side. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("no-drag inline-flex self-start rounded-md bg-muted p-0.5", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-6 rounded-[5px] px-2.5 text-sm font-medium transition-colors",
              selected ? "bg-card text-foreground shadow-float" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "no-drag relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors disabled:opacity-45",
        checked ? "bg-accent" : "bg-input",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-150",
          checked ? "translate-x-[14px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/** A range input whose filled track shows the value. */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  const filled = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ["--filled" as string]: `${filled}%` }}
      className={cn(
        "no-drag h-4 w-full cursor-pointer appearance-none bg-transparent",
        "[&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full",
        "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,hsl(var(--accent))_var(--filled),hsl(var(--input))_var(--filled))]",
        "[&::-webkit-slider-thumb]:-mt-[6.5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow",
        className,
      )}
    />
  );
}

/** Copies text and confirms in place for a moment. */
export function CopyButton({
  text,
  label = "Copy",
  className,
  showLabel = false,
}: {
  text: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard permission denied: nothing was copied, so no confirmation
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn(
        "no-drag inline-flex h-6 shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
      {showLabel && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}
