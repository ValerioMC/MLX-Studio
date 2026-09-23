<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { ApiError, api, baseUrl } from "@/lib/api/client";
import ModelCore from "@/components/instruments/ModelCore.vue";
import Callout from "@/components/ui/Callout.vue";

type ConnectionState = "ok" | "unreachable" | "unauthorized";

/** How long an unreachable engine counts as "still starting" before it's an error. */
const STARTUP_GRACE_MS = 20_000;

async function probeState(): Promise<ConnectionState> {
  try {
    const res = await fetch(`${baseUrl()}/health`);
    if (!res.ok) return "unreachable";
  } catch {
    return "unreachable";
  }
  try {
    await api("/settings");
    return "ok";
  } catch (e) {
    return e instanceof ApiError && e.status === 401 ? "unauthorized" : "ok";
  }
}

interface Probe {
  state: ConnectionState;
  /** Whether the engine has answered at least once since launch. */
  everConnected: boolean;
}

let connectedSinceLaunch = false;

async function probeBackend(): Promise<Probe> {
  const state = await probeState();
  if (state === "ok") connectedSinceLaunch = true;
  return { state, everConnected: connectedSinceLaunch };
}

// Poll fast while waiting for the engine, relax once it's up.
const { data: probe } = useQuery({
  queryKey: ["backend-health"],
  queryFn: probeBackend,
  refetchInterval: (query) => (query.state.data?.state === "ok" ? 5000 : 1500),
  retry: false,
});

const graceElapsed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  timer = setTimeout(() => {
    graceElapsed.value = true;
  }, STARTUP_GRACE_MS);
});
onBeforeUnmount(() => clearTimeout(timer));

const ERROR_MESSAGES: Record<Exclude<ConnectionState, "ok">, string> = {
  unreachable: "The local engine is not responding. Quit and reopen MLX Studio; if it keeps happening, check the logs.",
  unauthorized: "Another MLX Studio instance is holding the engine port. Quit both, then reopen the app.",
};

const state = computed(() => probe.value?.state);
// A cold app start legitimately takes a few seconds (the sidecar boots);
// report progress, not failure.
const starting = computed(() => state.value === "unreachable" && !probe.value?.everConnected && !graceElapsed.value);
const show = computed(() => !!probe.value && state.value !== undefined && state.value !== "ok");
</script>

<template>
  <Transition name="pane">
    <div v-if="show" class="pt-4">
      <div
        v-if="starting"
        role="status"
        class="flex items-center gap-3 rounded-control border border-line bg-surface/70 px-3.5 py-2.5 text-sm text-muted"
      >
        <ModelCore state="loading" :size="16" label="Starting" />
        Starting the local engine…
      </div>
      <Callout v-else>{{ ERROR_MESSAGES[state as Exclude<ConnectionState, "ok">] }}</Callout>
    </div>
  </Transition>
</template>
