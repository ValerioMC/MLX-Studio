import { useState } from "react";
import { baseUrl, getConfig } from "@/lib/api/client";
import { Badge, Button, Card } from "@/components/ui/primitives";
import type { Model } from "@/types";
import { Check, Copy, X } from "lucide-react";

type SnippetLang = "openai" | "langchain" | "curl";

const TABS: { id: SnippetLang; label: string }[] = [
  { id: "openai", label: "Python (OpenAI SDK)" },
  { id: "langchain", label: "LangChain" },
  { id: "curl", label: "curl" },
];

const TAB_STORAGE_KEY = "mlxstudio.connect.tab";

function initialTab(): SnippetLang {
  const saved = localStorage.getItem(TAB_STORAGE_KEY);
  return TABS.some((t) => t.id === saved) ? (saved as SnippetLang) : "openai";
}

function buildSnippet(lang: SnippetLang, apiBase: string, apiKey: string, modelId: string): string {
  switch (lang) {
    case "openai":
      return `# pip install openai
from openai import OpenAI

client = OpenAI(
    base_url="${apiBase}",
    api_key="${apiKey}",
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {"role": "user", "content": "Hello! Introduce yourself in one sentence."},
    ],
)
print(response.choices[0].message.content)`;
    case "langchain":
      return `# pip install langchain-openai
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="${apiBase}",
    api_key="${apiKey}",
    model="${modelId}",
)

response = llm.invoke("Hello! Introduce yourself in one sentence.")
print(response.content)`;
    case "curl":
      return `curl ${apiBase}/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
  }
}

export function ConnectDialog({ model, onClose }: { model: Model; onClose: () => void }) {
  // Remember the last language across dialogs: whoever integrates with
  // LangChain wants the LangChain tab every time.
  const [tab, setTab] = useState<SnippetLang>(initialTab);
  const selectTab = (t: SnippetLang) => {
    setTab(t);
    localStorage.setItem(TAB_STORAGE_KEY, t);
  };
  const cfg = getConfig();
  const apiBase = `${baseUrl()}/v1`;
  const snippet = buildSnippet(tab, apiBase, cfg.apiKey, model.id);
  const running = model.status === "running";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-[38rem] max-w-[92vw] space-y-4 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              Connect to {model.display_name}
              {running ? <Badge tone="green">running</Badge> : <Badge>installed</Badge>}
            </h2>
            <p className="text-xs text-muted-foreground">
              OpenAI-compatible API on localhost.
              {!running && " The model loads automatically on the first request."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <InfoRow label="Base URL" value={apiBase} />
          <InfoRow label="API key" value={cfg.apiKey} />
          <InfoRow label="Model" value={model.id} />
        </div>

        <div>
          <div className="flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={
                  "-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors " +
                  (tab === t.id
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <CodeBlock code={snippet} />
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-xs">{value}</span>
        <CopyButton text={value} />
      </span>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative mt-3">
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} bordered />
      </div>
    </div>
  );
}

function CopyButton({ text, bordered = false }: { text: string; bordered?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className={
        "shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground " +
        (bordered ? "border border-border bg-card" : "")
      }
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
