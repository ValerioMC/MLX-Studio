import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, Pencil, Play } from "lucide-react";
import { useConversations, useModels } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { contextSize } from "@/lib/format";
import { useChat } from "@/stores/chat";
import { useLive } from "@/stores/live";
import { usePreferences } from "@/stores/preferences";
import { StartModelDialog } from "@/components/models/StartModelDialog";
import { ModelFacts } from "@/components/models/ModelFacts";
import { Button, StatusDot, fieldClass } from "@/components/ui/primitives";
import type { Model } from "@/types";
import { ChatSettingsButton } from "./ChatSettings";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { Message } from "./Message";
import { regenerate, renameConversation, sendMessage, stopGenerating } from "./useChatSession";

/** Within this distance of the bottom, new output keeps the thread scrolled down. */
const STICK_THRESHOLD_PX = 72;

function ConversationTitle() {
  const conversationId = useChat((s) => s.conversationId);
  const { data: conversations } = useConversations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const title = conversations?.find((c) => c.id === conversationId)?.title || (conversationId ? "Untitled chat" : "New chat");

  if (editing && conversationId) {
    const save = () => {
      const next = draft.trim();
      setEditing(false);
      if (next && next !== title) void renameConversation(conversationId, next).catch(() => undefined);
    };
    return (
      <input
        autoFocus
        value={draft}
        aria-label="Chat title"
        maxLength={48}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className={cn(fieldClass, "h-8 max-w-[24rem] text-lg font-semibold")}
      />
    );
  }

  return (
    <h1 className="group flex min-w-0 items-center gap-1.5 text-lg font-semibold">
      <span className="truncate">{title}</span>
      {conversationId && (
        <button
          type="button"
          aria-label="Rename chat"
          title="Rename"
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </h1>
  );
}

function NoModelRunning({ installed, onStart }: { installed: Model[]; onStart: (model: Model) => void }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 pt-[12vh]">
      <div>
        <h2 className="text-xl font-semibold">Start a model to chat</h2>
        <p className="pt-1 text-md text-muted-foreground">
          {installed.length
            ? "Pick one of your installed models. It stays loaded until you stop it."
            : "You have no chat models yet. Download one from the catalog first."}
        </p>
      </div>
      {installed.length > 0 ? (
        <ul className="divide-y border-y">
          {installed.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <StatusDot tone="idle" />
              <span className="min-w-0 flex-1 truncate text-md font-medium">{m.display_name}</span>
              <ModelFacts model={m} />
              <Button variant="secondary" size="sm" onClick={() => onStart(m)}>
                <Play />
                Start
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <Button onClick={() => navigate("/catalog")}>Browse the catalog</Button>
        </div>
      )}
    </div>
  );
}

function FreshThread({ model, contextLength }: { model: Model; contextLength?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col items-start gap-2 pt-[18vh]">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <StatusDot tone="positive" />
        Running{contextLength ? ` with ${contextSize(contextLength)} context` : ""}
      </p>
      <h2 className="text-2xl font-semibold">{model.display_name}</h2>
      <ModelFacts model={model} />
      <p className="pt-2 text-md text-muted-foreground">Everything you send stays on this Mac.</p>
    </div>
  );
}

export function ChatView() {
  const { data: models } = useModels();
  const stats = useLive((s) => s.stats);
  const messages = useChat((s) => s.messages);
  const busy = useChat((s) => s.busy);
  const selected = useChat((s) => s.model);
  const setModel = useChat((s) => s.setModel);
  const maxTokens = usePreferences((s) => s.maxTokens);
  const [startTarget, setStartTarget] = useState<Model | null>(null);

  const running = models?.filter((m) => m.status === "running") ?? [];
  const installed = models?.filter((m) => m.status !== "running" && m.chat_capable !== false) ?? [];
  const activeModel = running.find((m) => m.id === selected) ?? running[0];
  const active = activeModel?.id ?? "";
  const selectedStopped = selected !== "" && !running.some((m) => m.id === selected) && messages.length > 0;
  const contextLength = stats?.loaded_models.find((m) => m.model_id === active)?.context_length;

  // --- scrolling: follow new output only while the reader is at the bottom.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    stickRef.current = true;
    setShowJump(false);
  }, []);

  useLayoutEffect(() => {
    if (stickRef.current) scrollToBottom(false);
    else setShowJump(true);
  }, [messages, scrollToBottom]);

  // A new question always brings the answer into view.
  const lastRole = messages[messages.length - 1]?.role;
  const count = messages.length;
  useEffect(() => {
    if (lastRole === "assistant" && busy) scrollToBottom(false);
  }, [count, lastRole, busy, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = atBottom;
    if (atBottom) setShowJump(false);
  };

  const onRegenerate = useCallback(() => regenerate(active), [active]);

  return (
    <div className="flex h-full min-h-0">
      <ConversationList />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between gap-4 px-6">
          <ConversationTitle />
          <div className="flex items-center gap-1.5">
            {running.length > 0 && (
              <select
                value={active}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Model"
                disabled={busy}
                className={cn(fieldClass, "h-7 w-auto max-w-[16rem] pr-7 text-sm")}
              >
                {running.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            )}
            <ChatSettingsButton />
          </div>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto px-6 [mask-image:linear-gradient(to_bottom,transparent,black_20px)]"
        >
          {messages.length === 0 && !activeModel && models && (
            <NoModelRunning installed={installed} onStart={setStartTarget} />
          )}
          {messages.length === 0 && activeModel && <FreshThread model={activeModel} contextLength={contextLength} />}
          {messages.length > 0 && (
            <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-7 pb-8 pt-4">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1}
                  onRegenerate={i === messages.length - 1 && active ? onRegenerate : undefined}
                  maxTokens={maxTokens}
                />
              ))}
            </div>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-[6.5rem] left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-medium shadow-dialog hover:bg-muted"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to latest
          </button>
        )}

        <div className="shrink-0 px-6 pb-5 pt-2">
          <div className="mx-auto w-full max-w-[44rem]">
            {selectedStopped && activeModel && (
              <p className="pb-2 text-sm text-caution">
                The model this chat used is not running. Replies will come from {activeModel.display_name}.
              </p>
            )}
            <Composer
              disabled={!active}
              canAttach={!!activeModel?.vision}
              placeholder={
                !active
                  ? "Start a model to send a message"
                  : activeModel?.vision
                    ? `Message ${activeModel.display_name}, or drop an image`
                    : `Message ${activeModel?.display_name ?? ""}`
              }
              onSend={(text, images) => sendMessage(active, text, images)}
              onStop={stopGenerating}
            />
            <p className="pt-1.5 text-center text-2xs text-muted-foreground">
              Enter to send, Shift+Enter for a new line
            </p>
          </div>
        </div>
      </section>

      {startTarget && (
        <StartModelDialog
          model={startTarget}
          onClose={() => setStartTarget(null)}
          onStarted={(m) => {
            setStartTarget(null);
            setModel(m.id);
          }}
        />
      )}
    </div>
  );
}
