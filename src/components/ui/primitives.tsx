import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type HTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80",
  secondary: "bg-card text-foreground shadow-float hover:bg-muted active:bg-muted/70",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/70",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
};

const sizes: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-sm",
  md: "h-8 gap-2 px-3 text-sm",
  icon: "h-8 w-8",
  "icon-sm": "h-6 w-6",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner in place of the icon and blocks clicks. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "no-drag inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-100",
        "disabled:pointer-events-none disabled:opacity-45 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export type Tone = "neutral" | "accent" | "positive" | "caution" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent/12 text-accent",
  positive: "bg-positive/12 text-positive",
  caution: "bg-caution/14 text-caution",
  danger: "bg-destructive/12 text-destructive",
};

/** A short fact about a model or job: size, quantization, capability. */
export function Tag({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[1.35rem] items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-xs font-medium tabular [&_svg]:h-3 [&_svg]:w-3",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A status light: filled when live, hollow when idle. */
export function StatusDot({ tone, className }: { tone: Tone | "idle"; className?: string }) {
  const color: Record<Tone | "idle", string> = {
    neutral: "bg-muted-foreground",
    accent: "bg-accent",
    positive: "bg-positive shadow-[0_0_0_3px_hsl(var(--positive)/0.18)]",
    caution: "bg-caution",
    danger: "bg-destructive",
    idle: "border border-muted-foreground/60 bg-transparent",
  };
  return <span aria-hidden className={cn("inline-block h-[7px] w-[7px] shrink-0 rounded-full", color[tone], className)} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-[4px] px-1 font-sans text-2xs font-medium text-muted-foreground/80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex min-h-[2.5rem] items-center justify-between gap-4 pb-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

/** What to do when a list is empty, with the action that fills it. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-1.5 rounded-lg border border-dashed px-6 py-8", className)}>
      <p className="text-md font-medium">{title}</p>
      {children && <p className="max-w-[46ch] text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function InlineError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive", className)}>
      {children}
    </p>
  );
}

/** Shared look for text inputs, selects and textareas. */
export const fieldClass =
  "no-drag w-full rounded-md border border-input bg-card px-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/25 focus-visible:outline-none disabled:opacity-50";
