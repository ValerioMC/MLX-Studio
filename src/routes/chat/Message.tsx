import { memo, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Markdown } from "@/components/chat/Markdown";
import { CopyButton } from "@/components/ui/controls";
import { Button } from "@/components/ui/primitives";
import { splitReasoning } from "@/lib/chat/reasoning";
import { cn } from "@/lib/utils";
import type { UIMsg } from "@/stores/chat";

function thoughtLabel(thinking: boolean, thoughtMs: number | undefined): string {
  if (thinking) return "Thinking";
  if (thoughtMs === undefined) return "Reasoning";
  const seconds = Math.max(1, Math.round(thoughtMs / 1000));
  return `Thought for ${seconds} s`;
}

function Reasoning({ text, thinking, thoughtMs }: { text: string; thinking: boolean; thoughtMs?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md py-0.5 pr-1.5 text-sm font-medium text-muted-foreground hover:text-foreground",
          thinking && "animate-pulse",
        )}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {thoughtLabel(thinking, thoughtMs)}
      </button>
      {open && (
        <div className="selectable ml-[7px] mt-1.5 whitespace-pre-wrap border-l-2 pl-4 text-sm leading-relaxed text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  );
}

function Stats({ message }: { message: UIMsg }) {
  if (message.tokPerSec == null || message.tokPerSec <= 0) return null;
  const firstToken =
    message.timeToFirstToken != null ? `, first token in ${message.timeToFirstToken.toFixed(1)} s` : "";
  return (
    <span className="tabular text-xs text-muted-foreground" title="Generation speed on this Mac">
      {message.tokPerSec.toFixed(1)} tok/s{firstToken}
    </span>
  );
}

function AssistantMessage({
  message,
  isLast,
  onRegenerate,
  maxTokens,
}: {
  message: UIMsg;
  isLast: boolean;
  onRegenerate?: () => void;
  maxTokens: number;
}) {
  const { reasoning, answer, thinking } = splitReasoning(message.content);
  const waiting = message.streaming && message.content === "";

  return (
    <article className="group/message" aria-busy={message.streaming || undefined}>
      {waiting && <p className="animate-pulse text-sm text-muted-foreground">Reading your message…</p>}
      {reasoning !== null && <Reasoning text={reasoning} thinking={thinking && !!message.streaming} thoughtMs={message.thoughtMs} />}
      {answer && <Markdown content={answer} />}

      {message.error && (
        <div className="mt-2 flex items-center gap-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <span className="flex-1">{message.error}</span>
          {isLast && onRegenerate && (
            <Button variant="secondary" size="sm" onClick={onRegenerate}>
              <RotateCcw />
              Try again
            </Button>
          )}
        </div>
      )}
      {message.finishReason === "length" && !message.streaming && (
        <p className="mt-2 text-sm text-caution">
          Stopped at the {maxTokens.toLocaleString()}-token limit. Raise “Longest reply” in chat settings for longer
          answers.
        </p>
      )}

      {!message.streaming && !message.error && (
        <div
          className={cn(
            "mt-1.5 flex h-6 items-center gap-1 transition-opacity",
            !isLast && "opacity-0 focus-within:opacity-100 group-hover/message:opacity-100",
          )}
        >
          <CopyButton text={answer} label="Copy answer" />
          {isLast && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate answer"
              title="Regenerate"
              className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="ml-1.5">
            <Stats message={message} />
          </span>
        </div>
      )}
    </article>
  );
}

function UserMessage({ message }: { message: UIMsg }) {
  return (
    <div className="flex flex-col items-end gap-2">
      {message.images && message.images.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {message.images.map((src, i) => (
            <img key={i} src={src} alt={`Attached image ${i + 1}`} className="max-h-48 max-w-[16rem] rounded-lg border object-cover" />
          ))}
        </div>
      )}
      {message.content && (
        <div className="selectable max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-md leading-relaxed [overflow-wrap:anywhere]">
          {message.content}
        </div>
      )}
    </div>
  );
}

export const Message = memo(function Message({
  message,
  isLast,
  onRegenerate,
  maxTokens,
}: {
  message: UIMsg;
  isLast: boolean;
  onRegenerate?: () => void;
  maxTokens: number;
}) {
  if (message.role === "user") return <UserMessage message={message} />;
  return <AssistantMessage message={message} isLast={isLast} onRegenerate={onRegenerate} maxTokens={maxTokens} />;
});
