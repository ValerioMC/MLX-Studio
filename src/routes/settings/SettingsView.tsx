import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { api, baseUrl, getConfig } from "@/lib/api/client";
import { queryClient, queryKeys, useAppSettings } from "@/lib/api/queries";
import { useUI, type Theme } from "@/stores/ui";
import { CopyButton, Segmented } from "@/components/ui/controls";
import { Button, PageHeader, fieldClass } from "@/components/ui/primitives";
import { ChatSettingsForm } from "@/routes/chat/ChatSettings";
import { openExternal } from "@/lib/openExternal";
import { cn } from "@/lib/utils";

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** A settings group: its name and purpose on the left, controls on the right. */
function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-x-10 gap-y-3 border-t py-6 md:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-md font-semibold">{title}</h2>
        <p className="pt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-base">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-md bg-muted/70 px-2 py-1 font-mono text-xs">{value}</code>
      <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} />
    </div>
  );
}

function HfTokenField({ configured }: { configured: boolean }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: string | null) =>
      api<{ hf_token_set: boolean }>("/settings/hf-token", { method: "PUT", body: JSON.stringify({ token: value }) }),
    onSuccess: (_res, value) => {
      setToken("");
      setStatus(value ? "Token saved." : "Token removed.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
    onError: (e) => setStatus(e.message),
  });

  return (
    <div className="flex flex-col gap-1.5">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) save.mutate(token.trim());
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={configured ? "A token is saved. Paste a new one to replace it." : "hf_…"}
          aria-label="Hugging Face token"
          autoComplete="off"
          spellCheck={false}
          className={cn(fieldClass, "h-8 flex-1 font-mono text-xs")}
        />
        <Button type="submit" size="md" disabled={!token.trim()} loading={save.isPending && save.variables !== null}>
          Save
        </Button>
        {configured && (
          <Button variant="secondary" loading={save.isPending && save.variables === null} onClick={() => save.mutate(null)}>
            Remove
          </Button>
        )}
      </form>
      <p className={cn("text-sm", save.isError ? "text-destructive" : "text-muted-foreground")}>
        {status ?? (
          <>
            Create a read token at{" "}
            <button
              type="button"
              onClick={() => void openExternal("https://huggingface.co/settings/tokens")}
              className="text-accent hover:underline"
            >
              huggingface.co/settings/tokens
            </button>
            .
          </>
        )}
      </p>
    </div>
  );
}

export function SettingsView() {
  const { theme, setTheme } = useUI();
  const cfg = getConfig();
  const { data: settings } = useAppSettings();

  return (
    <div>
      <PageHeader title="Settings" />

      <Section title="Appearance" description="System follows your Mac's light or dark setting.">
        <Segmented label="Theme" value={theme} options={THEMES} onChange={setTheme} />
      </Section>

      <Section title="Chat" description="Applied to every chat in the app. Apps using the API send their own.">
        <div className="max-w-[28rem]">
          <ChatSettingsForm />
        </div>
      </Section>

      <Section
        title="Local API"
        description="OpenAI-compatible. The address and key stay the same across launches."
      >
        <ValueRow label="Base URL" value={`${baseUrl()}/v1`} />
        <ValueRow label="API key" value={cfg.apiKey} />
        <p className="text-sm text-muted-foreground">
          Use a model's id, such as <code className="font-mono text-xs">qwen2.5-7b-instruct-4bit</code>, as the model
          name. Stopped models load on the first request.
        </p>
      </Section>

      <Section title="Hugging Face" description="Optional. A token raises rate limits and unlocks gated models.">
        <HfTokenField configured={settings?.hf_token_set ?? false} />
      </Section>

      <Section title="Storage" description="Where model weights are kept.">
        <div className="flex items-center gap-3 text-base">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted/70 px-2 py-1 font-mono text-xs">
            {settings?.models_dir ?? "…"}
          </code>
          {settings && <CopyButton text={settings.models_dir} label="Copy path" />}
        </div>
      </Section>

      <Section title="Memory" description="How MLX Studio decides whether a model fits.">
        <p className="max-w-[52ch] text-base text-muted-foreground">
          15% of memory is kept for macOS and your other apps. A model “fits” when it needs less than what is free
          after that reserve; “tight” models still start, because macOS reclaims cached memory, but other apps may
          slow down.
        </p>
      </Section>
    </div>
  );
}
