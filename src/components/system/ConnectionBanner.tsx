import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, baseUrl } from "@/lib/api/client";
import { AlertTriangle, Loader2 } from "lucide-react";

type ConnectionState = "ok" | "unreachable" | "unauthorized";

/** How long an unreachable engine counts as "still starting" before it's an error. */
const STARTUP_GRACE_MS = 20_000;

async function probeBackend(): Promise<ConnectionState> {
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
    return (e as Error).message === "Unauthorized" ? "unauthorized" : "ok";
  }
}

const ERROR_MESSAGES: Record<Exclude<ConnectionState, "ok">, string> = {
  unreachable:
    "The local engine is not responding. Quit and reopen MLX Studio; if it persists, check the logs.",
  unauthorized:
    "Another MLX Studio instance is holding the engine port. Quit both and reopen the app.",
};

export function ConnectionBanner() {
  // Poll fast while waiting for the engine, relax once it's up.
  const { data: state, dataUpdatedAt } = useQuery({
    queryKey: ["backend-health"],
    queryFn: probeBackend,
    refetchInterval: (query) => (query.state.data === "ok" ? 5000 : 1500),
    retry: false,
  });
  void dataUpdatedAt; // subscribed so failed re-probes still re-render the timer below
  const mountedAt = useRef(Date.now());
  const everConnected = useRef(false);
  if (state === "ok") everConnected.current = true;

  if (!state || state === "ok") return null;

  // A cold app start legitimately takes a few seconds (the sidecar boots);
  // report progress, not failure.
  const starting =
    state === "unreachable" &&
    !everConnected.current &&
    Date.now() - mountedAt.current < STARTUP_GRACE_MS;

  if (starting) {
    return (
      <div className="no-drag mx-8 mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>Starting the local engine…</span>
      </div>
    );
  }

  return (
    <div className="no-drag mx-8 mb-2 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{ERROR_MESSAGES[state]}</span>
    </div>
  );
}
