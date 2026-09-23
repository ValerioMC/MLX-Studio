import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";

const MAX_ATTACHMENTS = 4;
const MAX_HEIGHT_PX = 220;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function Composer({
  disabled,
  placeholder,
  canAttach,
  onSend,
  onStop,
}: {
  disabled: boolean;
  placeholder: string;
  canAttach: boolean;
  onSend: (text: string, images: string[]) => void;
  onStop: () => void;
}) {
  const input = useChat((s) => s.input);
  const setInput = useChat((s) => s.setInput);
  const busy = useChat((s) => s.busy);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Grow with the text, up to a limit, then scroll.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [input]);

  useEffect(() => {
    if (!disabled) textRef.current?.focus();
  }, [disabled]);

  // Attachments only make sense for the model they were picked for.
  useEffect(() => {
    if (!canAttach) setAttachments([]);
  }, [canAttach]);

  const addImages = async (files: Iterable<File>) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const urls = await Promise.all(images.map(readAsDataUrl));
    setAttachments((prev) => [...prev, ...urls].slice(0, MAX_ATTACHMENTS));
  };

  const canSend = !disabled && !busy && (input.trim() !== "" || attachments.length > 0);
  const send = () => {
    if (!canSend) return;
    onSend(input, attachments);
    setAttachments([]);
  };

  return (
    <div
      onDragOver={(e) => {
        if (!canAttach) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canAttach) return;
        e.preventDefault();
        setDragging(false);
        void addImages(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-2xl border border-input bg-card p-2 shadow-[0_1px_2px_hsl(230_20%_10%/0.05)] transition-colors focus-within:border-accent/60",
        dragging && "border-accent bg-accent/[0.04]",
        disabled && "opacity-60",
      )}
    >
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-1.5 pb-2 pt-1">
          {attachments.map((src, i) => (
            <li key={i} className="relative">
              <img src={src} alt={`Attachment ${i + 1}`} className="h-16 w-16 rounded-lg border object-cover" />
              <button
                type="button"
                aria-label={`Remove attachment ${i + 1}`}
                onClick={() => setAttachments((prev) => prev.filter((_, k) => k !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background hover:bg-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-1.5">
        {canAttach && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void addImages(e.target.files ?? []);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Attach images"
              title="Attach images (you can also paste or drop them)"
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
            </Button>
          </>
        )}
        <textarea
          ref={textRef}
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter confirms an IME composition (Japanese, Chinese); it must not send.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={(e) => {
            if (!canAttach) return;
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void addImages(files);
            }
          }}
          rows={1}
          aria-label="Message"
          placeholder={placeholder}
          className="max-h-[220px] min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-md leading-relaxed outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none"
        />
        {busy ? (
          <Button variant="secondary" size="icon" aria-label="Stop generating" title="Stop" onClick={onStop} className="rounded-full">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button size="icon" aria-label="Send" title="Send" disabled={!canSend} onClick={send} className="rounded-full">
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  );
}
