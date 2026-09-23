import { useState } from "react";
import { baseUrl, getConfig } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { CopyButton } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import type { Model } from "@/types";
import { buildSnippet, SNIPPET_TABS, type SnippetLang } from "./snippets";

const TAB_STORAGE_KEY = "mlxstudio.connect.tab";

function initialTab(): SnippetLang {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return SNIPPET_TABS.find((t) => t.id === saved)?.id ?? "openai";
  } catch {
    return "openai";
  }
}

function rememberTab(tab: SnippetLang): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}

export function ConnectDialog({ model, onClose }: { model: Model; onClose: () => void }) {
  // Remember the last language across dialogs: whoever integrates with
  // LangChain wants the LangChain tab every time.
  const [tab, setTab] = useState<SnippetLang>(initialTab);
  const cfg = getConfig();
  const apiBase = `${baseUrl()}/v1`;
  const snippet = buildSnippet(tab, apiBase, cfg.apiKey, model.id);
  const running = model.status === "running";

  const selectTab = (next: SnippetLang) => {
    setTab(next);
    rememberTab(next);
  };

  return (
    <Dialog
      title={`Use ${model.display_name} from code`}
      description={
        running
          ? "It is running and answers on an OpenAI-compatible API on this Mac."
          : "It answers on an OpenAI-compatible API on this Mac, and loads on the first request."
      }
      onClose={onClose}
      className="w-[42rem]"
    >
      <dl className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
        {[
          ["Base URL", apiBase],
          ["API key", cfg.apiKey],
          ["Model", model.id],
        ].map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="selectable truncate font-mono text-xs">{value}</dd>
            <CopyButton text={value ?? ""} label={`Copy ${label?.toLowerCase()}`} />
          </div>
        ))}
      </dl>

      <div role="tablist" aria-label="Language" className="flex gap-4 border-b">
        {SNIPPET_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={cn(
              "-mb-px border-b-2 pb-2 pt-1 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="relative mt-3">
        <pre className="max-h-[18rem] overflow-auto rounded-lg bg-muted/60 p-3.5 font-mono text-xs leading-relaxed">
          {snippet}
        </pre>
        <CopyButton text={snippet} label="Copy code" showLabel className="absolute right-2 top-2 bg-card shadow-float" />
      </div>
    </Dialog>
  );
}
