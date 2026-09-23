import { cn } from "@/lib/utils";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

/** A panel anchored under its trigger; outside clicks and Escape close it. */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  className,
  label,
}: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute right-0 top-full z-40 mt-1.5 w-[22rem] animate-dialog-in rounded-xl bg-card p-4 shadow-dialog",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
