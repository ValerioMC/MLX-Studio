import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useConversations } from "@/lib/api/queries";
import { groupByDate, parseServerDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Button, Kbd } from "@/components/ui/primitives";
import type { Conversation } from "@/types";
import { deleteConversation, openConversation } from "./useChatSession";

export function ConversationList() {
  const { data: conversations } = useConversations();
  const conversationId = useChat((s) => s.conversationId);
  const busy = useChat((s) => s.busy);
  const reset = useChat((s) => s.reset);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const groups = groupByDate(conversations ?? [], (c) => parseServerDate(c.updated_at));

  return (
    <aside aria-label="Conversations" className="flex w-[15rem] shrink-0 flex-col border-r">
      <div className="flex h-10 shrink-0 items-center px-3">
        <Button variant="secondary" className="w-full justify-between" disabled={busy} onClick={reset}>
          <span className="inline-flex items-center gap-2">
            <Plus />
            New chat
          </span>
          <Kbd>⌘N</Kbd>
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {groups.map(({ group, items }) => (
          <section key={group} className="pt-3">
            <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group}</h3>
            <ul className="flex flex-col gap-px">
              {items.map((c) => {
                const active = c.id === conversationId;
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      disabled={busy && !active}
                      aria-current={active ? "page" : undefined}
                      onClick={() => void openConversation(c).catch(() => undefined)}
                      className={cn(
                        "flex h-7 w-full items-center rounded-md pl-2 pr-7 text-left text-base transition-colors disabled:opacity-50",
                        active ? "bg-foreground/[0.07] text-foreground" : "text-foreground/80 hover:bg-foreground/[0.04]",
                      )}
                    >
                      <span className="truncate">{c.title || "Untitled chat"}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete “${c.title || "Untitled chat"}”`}
                      title="Delete"
                      onClick={() => setDeleteTarget(c)}
                      className="absolute right-1 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-destructive/12 hover:text-destructive focus-visible:flex group-hover:flex"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {conversations?.length === 0 && (
          <p className="px-2 pt-3 text-sm text-muted-foreground">Your chats are saved here, on this Mac.</p>
        )}
      </nav>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this chat?"
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            setDeleting(true);
            deleteConversation(deleteTarget.id)
              .catch(() => undefined)
              .finally(() => {
                setDeleting(false);
                setDeleteTarget(null);
              });
          }}
        >
          “{deleteTarget.title || "Untitled chat"}” and all its messages will be removed.
        </ConfirmDialog>
      )}
    </aside>
  );
}
