<script setup lang="ts">
/**
 * ⌘K: one box that reaches everything — pages, every model (chat with a
 * running one, start an idle one, stop one), new chat, the theme, and a
 * catalog search for whatever was typed. Type to filter (fuzzy, word starts
 * first), ↑/↓ to move, Enter to run, Escape to close.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from "vue";
import { useRouter } from "vue-router";
import { CornerDownLeft, MessageSquarePlus, Moon, Palette, Search, Square, Sun, Play, MessageSquare } from "lucide-vue-next";
import { useModels } from "@/lib/api/queries";
import { fuzzyScore } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { useUI } from "@/stores/ui";
import { useCoreState } from "@/composables/useCoreState";
import { useModelAction } from "@/components/models/useModelActions";
import ModelCore, { type CoreState } from "@/components/instruments/ModelCore.vue";
import Kbd from "@/components/ui/Kbd.vue";
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation";

interface Command {
  id: string;
  group: "Go to" | "Models" | "Actions";
  label: string;
  hint?: string;
  icon?: Component;
  core?: { state: CoreState; tone: number };
  keys?: string;
  run: () => void;
}

const MAX_RESULTS = 12;

const router = useRouter();
const ui = useUI();
const chat = useChat();
const { data: models } = useModels();
const { stateOf, toneOf } = useCoreState();
const { mutate: stopModel } = useModelAction("stop");

const query = ref("");
const active = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLUListElement | null>(null);

function close(): void {
  ui.paletteOpen = false;
}
function go(path: string): void {
  void router.push(path);
}

const commands = computed<Command[]>(() => {
  const pages: Command[] = [...NAV_ITEMS, SETTINGS_ITEM].map((item) => ({
    id: `page:${item.to}`,
    group: "Go to",
    label: item.label,
    icon: item.icon,
    keys: `⌘${item.shortcut}`,
    run: () => go(item.to),
  }));

  const modelCommands: Command[] = (models.value ?? [])
    .filter((m) => m.chat_capable !== false)
    .flatMap((m): Command[] => {
      const core = { state: stateOf(m), tone: toneOf(m) };
      if (m.status === "running") {
        return [
          {
            id: `chat:${m.id}`,
            group: "Models",
            label: `Chat with ${m.display_name}`,
            icon: MessageSquare,
            core,
            run: () => {
              chat.model = m.id;
              go("/chat");
            },
          },
          { id: `stop:${m.id}`, group: "Models", label: `Stop ${m.display_name}`, icon: Square, core, run: () => stopModel(m.id) },
        ];
      }
      return [
        {
          id: `start:${m.id}`,
          group: "Models",
          label: `Start ${m.display_name}`,
          hint: "Choose context…",
          icon: Play,
          core,
          run: () => ui.requestStart(m, "open-chat"),
        },
      ];
    });

  const dark = ui.theme === "dark" || (ui.theme === "system" && !document.documentElement.classList.contains("light"));
  const actions: Command[] = [
    {
      id: "new-chat",
      group: "Actions",
      label: "New chat",
      icon: MessageSquarePlus,
      keys: "⌘N",
      run: () => {
        if (!chat.busy) chat.reset();
        go("/chat");
      },
    },
    {
      id: "design",
      group: "Actions",
      label: "Open the design system",
      icon: Palette,
      run: () => go("/design"),
    },
    {
      id: "theme",
      group: "Actions",
      label: dark ? "Switch to light appearance" : "Switch to dark appearance",
      icon: dark ? Sun : Moon,
      run: () => ui.setTheme(dark ? "light" : "dark"),
    },
  ];

  const typed = query.value.trim();
  if (typed) {
    actions.push({
      id: "catalog-search",
      group: "Actions",
      label: `Search the catalog for “${typed}”`,
      icon: Search,
      run: () => go(`/catalog?q=${encodeURIComponent(typed)}`),
    });
  }
  return [...pages, ...modelCommands, ...actions];
});

const results = computed(() => {
  const typed = query.value.trim();
  if (!typed) return commands.value.slice(0, MAX_RESULTS);
  return commands.value
    .map((command) => ({ command, score: command.id === "catalog-search" ? 0.5 : fuzzyScore(typed, command.label) }))
    .filter((r): r is { command: Command; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((r) => r.command);
});

/** Results grouped for display, keeping the ranked order inside each group. */
const grouped = computed(() => {
  const groups = new Map<Command["group"], { command: Command; index: number }[]>();
  results.value.forEach((command, index) => {
    const bucket = groups.get(command.group) ?? [];
    bucket.push({ command, index });
    groups.set(command.group, bucket);
  });
  return [...groups.entries()];
});

watch(query, () => {
  active.value = 0;
});

function run(command: Command | undefined): void {
  if (!command) return;
  close();
  command.run();
}

async function onKey(event: KeyboardEvent): Promise<void> {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    active.value = (active.value + step + results.value.length) % Math.max(results.value.length, 1);
    await nextTick();
    listRef.value?.querySelector(`[data-index="${active.value}"]`)?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter") {
    event.preventDefault();
    run(results.value[active.value]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}

let opener: HTMLElement | null = null;
onMounted(() => {
  opener = document.activeElement as HTMLElement | null;
  inputRef.value?.focus();
});
onBeforeUnmount(() => opener?.focus?.());
</script>

<template>
  <Teleport to="body">
    <Transition name="scrim" appear>
      <div class="no-drag fixed inset-0 z-modal flex justify-center bg-canvas/55 px-6 pt-[14vh] backdrop-blur-[5px]" @mousedown.self="close">
        <Transition name="dialog" appear>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            class="edge-lit flex h-fit max-h-[62vh] w-[36rem] max-w-full flex-col overflow-hidden rounded-card border border-line bg-surface/95 shadow-modal backdrop-blur-2xl"
          >
            <div class="flex items-center gap-3 border-b border-line px-4">
              <Search class="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              <input
                ref="inputRef"
                v-model="query"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                :aria-activedescendant="`palette-${active}`"
                aria-label="Command"
                placeholder="Type a command, a model or a page…"
                spellcheck="false"
                class="h-[52px] flex-1 bg-transparent text-md text-fg outline-none placeholder:text-subtle"
                @keydown="onKey"
              />
              <Kbd>esc</Kbd>
            </div>

            <ul id="palette-list" ref="listRef" role="listbox" class="min-h-0 overflow-y-auto p-2">
              <template v-for="[group, items] in grouped" :key="group">
                <li role="presentation" class="px-2.5 pb-1 pt-2.5 text-xs font-medium text-subtle first:pt-1">{{ group }}</li>
                <li
                  v-for="{ command, index } in items"
                  :id="`palette-${index}`"
                  :key="command.id"
                  role="option"
                  :data-index="index"
                  :aria-selected="index === active"
                  :class="
                    cn(
                      'relative flex h-[38px] cursor-default items-center gap-3 rounded-control px-2.5 text-base',
                      index === active ? 'bg-fg/[0.07] text-fg' : 'text-muted',
                    )
                  "
                  @mousemove="active = index"
                  @click="run(command)"
                >
                  <span
                    v-if="index === active"
                    aria-hidden="true"
                    class="absolute -left-2 bottom-2 top-2 w-[3px] rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.7)]"
                  />
                  <ModelCore v-if="command.core" :state="command.core.state" :tone="command.core.tone" :size="16" />
                  <component :is="command.icon" v-else-if="command.icon" class="h-4 w-4 shrink-0 text-subtle" />
                  <span class="min-w-0 flex-1 truncate">{{ command.label }}</span>
                  <span v-if="command.hint" class="text-xs text-subtle">{{ command.hint }}</span>
                  <Kbd v-if="command.keys">{{ command.keys }}</Kbd>
                  <CornerDownLeft v-else-if="index === active" class="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
                </li>
              </template>
              <li v-if="results.length === 0" class="px-3 py-8 text-center text-sm text-muted">Nothing matches.</li>
            </ul>

            <footer class="flex items-center gap-4 border-t border-line bg-canvas/40 px-4 py-2 text-xs text-subtle">
              <span class="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
              <span class="flex items-center gap-1.5"><Kbd>↵</Kbd> run</span>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
