import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { Slider } from "@/components/ui/controls";
import { Button, fieldClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CHAT_PREFERENCES,
  MAX_TOKENS_RANGE,
  TEMPERATURE_RANGE,
  usePreferences,
} from "@/stores/preferences";

/** System prompt, temperature and reply length, remembered across launches. */
export function ChatSettingsForm() {
  const { systemPrompt, temperature, maxTokens, update, resetChat } = usePreferences();
  const isDefault =
    systemPrompt === DEFAULT_CHAT_PREFERENCES.systemPrompt &&
    temperature === DEFAULT_CHAT_PREFERENCES.temperature &&
    maxTokens === DEFAULT_CHAT_PREFERENCES.maxTokens;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium">System prompt</span>
        <textarea
          value={systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          rows={4}
          placeholder="How the model should behave in every chat, e.g. “Answer briefly. Use British spelling.”"
          className={cn(fieldClass, "resize-none py-2 leading-snug")}
        />
      </label>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-medium">Temperature</span>
          <span className="tabular text-base">{temperature.toFixed(2)}</span>
        </div>
        <Slider label="Temperature" {...TEMPERATURE_RANGE} value={temperature} onChange={(v) => update({ temperature: v })} />
        <p className="text-xs text-muted-foreground">Lower is focused and repeatable, higher is varied.</p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-medium">Longest reply</span>
          <span className="tabular text-base">
            {maxTokens.toLocaleString()} <span className="text-muted-foreground">tokens</span>
          </span>
        </div>
        <Slider label="Longest reply" {...MAX_TOKENS_RANGE} value={maxTokens} onChange={(v) => update({ maxTokens: v })} />
        <p className="text-xs text-muted-foreground">Reasoning models spend part of this on thinking.</p>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" disabled={isDefault} onClick={resetChat}>
          Restore defaults
        </Button>
      </div>
    </div>
  );
}

export function ChatSettingsButton() {
  const [open, setOpen] = useState(false);
  const customized = usePreferences((s) => s.systemPrompt.trim() !== "");
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label="Chat settings"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Chat settings"
          aria-expanded={open}
          title="Chat settings"
          onClick={() => setOpen((o) => !o)}
          className={cn("relative", open && "bg-muted text-foreground")}
        >
          <SlidersHorizontal />
          {customized && <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
        </Button>
      }
    >
      <ChatSettingsForm />
    </Popover>
  );
}
