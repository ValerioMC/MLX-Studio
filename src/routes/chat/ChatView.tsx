import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { streamChat, type ChatMsg } from "@/lib/api/chat";
import { Button } from "@/components/ui/primitives";
import { Markdown } from "@/components/chat/Markdown";
import { useChat } from "@/stores/chat";
import type { Model } from "@/types";
import { Send, Square, Plus } from "lucide-react";

export function ChatView() {
  const { data: models } = useQuery({ queryKey: ["models"], queryFn: () => api<Model[]>("/models") });
  const running = models?.filter((m) => m.status === "running") ?? [];
  const { messages, input, model, busy, setInput, setModel, setBusy, setAbort, setMessages, reset } =
    useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = model || running[0]?.id || "";

  const send = () => {
    if (!input.trim() || !active) return;
    const next = [...messages, { role: "user" as const, content: input }];
    setMessages([...next, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setBusy(true);

    const history: ChatMsg[] = next.map(({ role, content }) => ({ role, content }));
    setAbort(
      streamChat(
        active,
        history,
        {},
        (token) =>
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: copy[copy.length - 1].content + token,
            };
            requestAnimationFrame(() =>
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
            );
            return copy;
          }),
        () => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false };
            return copy;
          });
          setBusy(false);
        },
      ),
    );
  };

  const stop = () => {
    useChat.getState().abort?.();
    setBusy(false);
  };

  return (
    <div className="animate-fade-in flex min-h-0 flex-1 flex-col pt-2">
      <header className="flex shrink-0 items-center justify-between pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={active}
            onChange={(e) => setModel(e.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {running.length === 0 && <option value="">No model running</option>}
            {running.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => reset()}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {running.length
              ? "Start chatting with your local model."
              : "Start a model from the Models tab to begin."}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm " +
                (m.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "bg-card border border-border")
              }
            >
              {m.role === "assistant" ? <Markdown content={m.content || "…"} /> : m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex shrink-0 items-end gap-2 rounded-xl border border-input bg-card p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Message…"
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        {busy ? (
          <Button variant="destructive" size="icon" onClick={stop}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={send} disabled={!active}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
