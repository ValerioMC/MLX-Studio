import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { streamChat, type ChatMsg } from "@/lib/api/chat";
import { Button } from "@/components/ui/primitives";
import { Markdown } from "@/components/chat/Markdown";
import { useChat } from "@/stores/chat";
import { cn } from "@/lib/utils";
import type { Conversation, Model } from "@/types";
import {
  Send,
  Square,
  Plus,
  Trash2,
  MessageSquare,
  ImagePlus,
  X,
} from "lucide-react";

const MAX_ATTACHMENTS = 4;

interface StoredMessage {
  role: ChatMsg["role"];
  content: string;
  tok_per_sec?: number | null;
}

export function ChatView() {
  const qc = useQueryClient();
  const { data: models } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Model[]>("/models"),
  });
  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ items: Conversation[] }>("/conversations"),
  });
  const running = models?.filter((m) => m.status === "running") ?? [];
  const {
    messages,
    input,
    model,
    busy,
    conversationId,
    setInput,
    setModel,
    setBusy,
    setConversationId,
    setAbort,
    setMessages,
    reset,
  } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Pending image attachments as data URLs; only offered for vision models.
  const [attachments, setAttachments] = useState<string[]>([]);

  const active = model || running[0]?.id || "";
  const activeModel = running.find((m) => m.id === active);
  const canAttach = !!activeModel?.vision;

  const addImages = (files: Iterable<File>) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () =>
        setAttachments((prev) =>
          prev.length >= MAX_ATTACHMENTS
            ? prev
            : [...prev, String(reader.result)],
        );
      reader.readAsDataURL(file);
    }
  };

  const persistExchange = (
    convId: string,
    userText: string,
    assistant: StoredMessage,
  ) => {
    api(`/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: userText }, assistant],
      }),
    })
      .then(() => qc.invalidateQueries({ queryKey: ["conversations"] }))
      .catch(() => {
        /* history is best-effort; the live thread is unaffected */
      });
  };

  const send = async () => {
    if ((!input.trim() && attachments.length === 0) || !active || busy) return;
    const userText = input;
    const userImages = attachments;
    const next = [
      ...messages,
      {
        role: "user" as const,
        content: userText,
        images: userImages.length ? userImages : undefined,
      },
    ];
    setMessages([...next, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setAttachments([]);
    setBusy(true);

    let convId = conversationId;
    if (!convId) {
      try {
        const conv = await api<Conversation>("/conversations", {
          method: "POST",
          body: JSON.stringify({ model_id: active }),
        });
        convId = conv.id;
        setConversationId(convId);
      } catch {
        convId = null; // keep chatting unpersisted rather than blocking
      }
    }

    // Accumulated outside React state so onDone can persist the final text
    // without reading state mid-update.
    let assistantText = "";

    // Messages with images become OpenAI-style content parts; past images stay
    // in the history so a vision model keeps seeing them on follow-up turns.
    const history: ChatMsg[] = next.map(({ role, content, images }) =>
      images?.length
        ? {
            role,
            content: [
              ...images.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
              ...(content ? [{ type: "text" as const, text: content }] : []),
            ],
          }
        : { role, content },
    );
    setAbort(
      streamChat(
        active,
        history,
        {},
        (token) => {
          assistantText += token;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: copy[copy.length - 1].content + token,
            };
            requestAnimationFrame(() =>
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
              }),
            );
            return copy;
          });
        },
        (meta) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = {
              ...last,
              streaming: false,
              error: !!meta.error,
              tokPerSec: meta.tokPerSec,
              content: meta.error
                ? [last.content, `Something went wrong: ${meta.error}`]
                    .filter(Boolean)
                    .join("\n\n")
                : last.content,
            };
            return copy;
          });
          setBusy(false);
          if (convId && !meta.error && assistantText) {
            persistExchange(convId, userText, {
              role: "assistant",
              content: assistantText,
              tok_per_sec: meta.tokPerSec ?? null,
            });
          }
        },
      ),
    );
  };

  const stop = () => {
    useChat.getState().abort?.();
    setBusy(false);
  };

  const openConversation = async (c: Conversation) => {
    if (busy || c.id === conversationId) return;
    try {
      const res = await api<{ items: StoredMessage[] }>(
        `/conversations/${c.id}/messages`,
      );
      setMessages(
        res.items.map((m) => ({
          role: m.role,
          content: m.content,
          tokPerSec: m.tok_per_sec ?? undefined,
        })),
      );
      setConversationId(c.id);
      if (c.model_id) setModel(c.model_id);
    } catch {
      /* conversation may have been deleted elsewhere */
    }
  };

  const deleteConversation = async (id: string) => {
    await api(`/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["conversations"] });
    if (id === conversationId) reset();
  };

  return (
    <div className="animate-fade-in flex min-h-0 flex-1 gap-5 pt-2">
      <aside className="flex w-56 shrink-0 flex-col">
        <Button
          variant="secondary"
          size="sm"
          className="mb-3 w-full"
          disabled={busy}
          onClick={reset}
        >
          <Plus className="h-4 w-4" /> New chat
        </Button>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {convs?.items.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                c.id === conversationId
                  ? "bg-accent/10 text-accent ring-1 ring-accent/40"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {c.title || "New chat"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(c.id);
                }}
                title="Delete conversation"
                className="hidden shrink-0 rounded p-0.5 hover:bg-destructive/15 hover:text-destructive group-hover:block"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {!convs?.items.length && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No conversations yet.
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between pb-3">
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
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
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2"
        >
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              {running.length
                ? "Start chatting with your local model."
                : "Start a model from the Models tab to begin."}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm " +
                  (m.role === "user"
                    ? "bg-accent text-accent-foreground"
                    : m.error
                      ? "bg-card border border-destructive/60"
                      : "bg-card border border-border")
                }
              >
                {m.images && m.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {m.images.map((src, k) => (
                      <img
                        key={k}
                        src={src}
                        alt="attachment"
                        className="max-h-40 rounded-lg border border-border/50 object-contain"
                      />
                    ))}
                  </div>
                )}
                {m.role === "assistant" ? (
                  <Markdown content={m.content || "…"} />
                ) : (
                  m.content
                )}
                {m.role === "assistant" &&
                  !m.streaming &&
                  m.tokPerSec != null && (
                    <p className="mt-1 text-right text-[10px] text-muted-foreground">
                      {m.tokPerSec.toFixed(1)} tok/s
                    </p>
                  )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 shrink-0 rounded-xl border border-input bg-card p-2">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
              {attachments.map((src, i) => (
                <div key={i} className="group relative">
                  <img
                    src={src}
                    alt={`attachment ${i + 1}`}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, k) => k !== i))
                    }
                    title="Remove image"
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            {canAttach && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addImages(e.target.files ?? []);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  title="Attach images (or paste)"
                  disabled={busy || attachments.length >= MAX_ATTACHMENTS}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
              </>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onPaste={(e) => {
                if (!canAttach) return;
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  addImages(files);
                }
              }}
              rows={1}
              placeholder={
                canAttach ? "Message… (images can be pasted)" : "Message…"
              }
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
      </div>
    </div>
  );
}
