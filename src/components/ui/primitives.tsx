import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef, type HTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-sm hover:shadow-glow",
  secondary: "bg-muted text-foreground hover:bg-muted/70 border border-border",
  ghost: "hover:bg-muted text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-[0_0_10px_hsl(var(--destructive)/0.6)]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  icon: "h-8 w-8",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "no-drag inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-wide transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/70 p-4 backdrop-blur-sm transition-colors hover:border-accent/40",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "accent" | "green" | "amber" | "red";
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    accent: "bg-accent/15 text-accent",
    green: "bg-green-500/15 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    red: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
