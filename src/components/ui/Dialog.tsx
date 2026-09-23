import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from "react";
import { Button } from "./primitives";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: Escape and the scrim close it, Tab stays inside, and focus
 * returns to whatever opened it.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  className,
  dismissible = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** False while an action is in flight that closing would orphan. */
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Latest props for the key handler, which is bound once for the dialog's life.
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useLayoutEffect(() => {
    closeRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl?.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="no-drag fixed inset-0 z-50 flex animate-scrim-in items-center justify-center bg-[hsl(230_20%_6%/0.42)] p-6 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-[88vh] w-[30rem] max-w-full animate-dialog-in flex-col rounded-xl bg-card text-card-foreground shadow-dialog outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="-mr-1.5">
              <X />
            </Button>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Yes/no for destructive actions, in place of window.confirm. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      dismissible={!busy}
      className="w-[26rem]"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-base text-muted-foreground">{children}</div>
    </Dialog>
  );
}
