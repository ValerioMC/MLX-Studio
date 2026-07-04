import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui/primitives";
import { useUI, type Theme } from "@/stores/ui";
import { api, getConfig } from "@/lib/api/client";

export function SettingsView() {
  const { theme, setTheme } = useUI();
  const cfg = getConfig();

  return (
    <div className="animate-fade-in space-y-6 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <Section title="Appearance" desc="Theme follows the system by default.">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={
                "rounded-md border px-3 py-1.5 text-sm capitalize transition-colors " +
                (theme === t
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border hover:bg-muted")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="API"
        desc="OpenAI-compatible local server. Port and key are stable across launches."
      >
        <CopyableField label="Base URL" value={`http://127.0.0.1:${cfg.port}/v1`} />
        <CopyableField label="API key" value={cfg.apiKey} />
        <p className="text-xs text-muted-foreground">
          Point any OpenAI client (e.g. LangChain's <span className="font-mono">ChatOpenAI</span>) at
          the base URL with this key. Use the model id (e.g.{" "}
          <span className="font-mono">qwen2.5-14b-instruct-4bit</span>) as the model name.
        </p>
      </Section>

      <Section
        title="Hugging Face"
        desc="Optional access token. Raises download rate limits and speeds up downloads."
      >
        <HfTokenField />
      </Section>

      <Section title="Models directory" desc="Where weights are stored.">
        <Field label="Path" value="~/.mlxstudio/models" mono />
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Change…
        </button>
      </Section>

      <Section title="Performance" desc="Defaults applied when loading a model.">
        <Field label="Default context length" value="4096 tokens" />
        <Field label="Memory safety reserve" value="15% of total RAM" />
      </Section>
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-xs">{value}</span>
        <button
          onClick={copy}
          className="shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function HfTokenField() {
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api<{ hf_token_set: boolean }>("/settings")
      .then((s) => setConfigured(s.hf_token_set))
      .catch(() => setConfigured(false));
  }, []);

  const save = async (value: string) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await api<{ hf_token_set: boolean }>("/settings/hf-token", {
        method: "PUT",
        body: JSON.stringify({ token: value || null }),
      });
      setConfigured(res.hf_token_set);
      setToken("");
      setStatus(value ? "Token saved." : "Token cleared.");
    } catch (e) {
      setStatus((e as Error).message || "Failed to save token.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={configured ? "•••••••• (a token is configured)" : "hf_..."}
          className="h-9 flex-1 rounded-md border border-input bg-card px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" disabled={saving || !token} onClick={() => save(token)}>
          Save
        </Button>
        {configured && (
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => save("")}>
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {status ??
          (configured
            ? "A token is configured. Enter a new one to replace it."
            : "Create a read token at huggingface.co/settings/tokens.")}
      </p>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
