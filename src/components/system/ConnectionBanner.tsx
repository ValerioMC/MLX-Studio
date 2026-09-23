import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, baseUrl } from "@/lib/api/client";
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
    return e instanceof ApiError && e.status === 401 ? "unauthorized" : "ok";
  }
}

const ERROR_MESSAGES: Record<Exclude<ConnectionState, "ok">, string> = {
  unreachable: "The local engine is not responding. Quit and reopen MLX Studio; if it keeps happening, check the logs.",
  unauthorized: "Another MLX Studio instance is holding the engine port. Quit both, then reopen the app.",
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
  const starting = state === "unreachable" && !everConnected.current && Date.now() - mountedAt.current < STARTUP_GRACE_MS;

  return (
    <div className="no-drag px-8 pb-3">
      <div
        role="status"
        className={
          starting
            ? "mx-auto flex max-w-[64rem] items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
            : "mx-auto flex max-w-[64rem] items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        }
      >
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>{starting ? "Starting the local engine…" : ERROR_MESSAGES[state]}</span>
      </div>
    </div>
  );
}
