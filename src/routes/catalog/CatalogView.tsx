import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { bytes, params } from "@/lib/format";
import type { Model } from "@/types";
import { Link } from "react-router-dom";
import { Search, Download, Check, Eye, MessageSquare } from "lucide-react";

interface CatalogResult extends Model {}

export function CatalogView() {
  const [q, setQ] = useState("");
  const [quant, setQuant] = useState<string | null>(null);
  const [vision, setVision] = useState<boolean | null>(null);
  const qc = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["catalog", q, quant, vision],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "30" });
      if (q) p.set("q", q);
      if (quant) p.set("quant", quant);
      if (vision !== null) p.set("vision", String(vision));
      return api<{ items: CatalogResult[] }>(`/catalog/search?${p}`);
    },
  });

  const download = useMutation({
    mutationFn: (repo: string) =>
      api("/downloads", { method: "POST", body: JSON.stringify({ repo_id: repo }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["downloads"] }),
  });

  return (
    <div className="animate-fade-in space-y-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Model Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Discover MLX-compatible models from Hugging Face.
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search models…  (⌘F)"
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Filter label="4-bit" active={quant === "4bit"} onClick={() => setQuant(quant === "4bit" ? null : "4bit")} />
        <Filter label="8-bit" active={quant === "8bit"} onClick={() => setQuant(quant === "8bit" ? null : "8bit")} />
        <Filter label="Vision" active={vision === true} onClick={() => setVision(vision ? null : true)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {isFetching && !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
            ))
          : data?.items.map((m) => (
              <Card key={m.hf_repo_id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium leading-tight">{m.display_name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.hf_repo_id}</p>
                  </div>
                  <FitBadge fit={m.fit} />
                </div>

                {m.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{params(m.params_b)}</Badge>
                  {m.quantization && <Badge>{m.quantization}</Badge>}
                  {m.vision && (
                    <Badge tone="accent">
                      <Eye className="mr-1 h-3 w-3" />
                      vision
                    </Badge>
                  )}
                  {m.instruct && (
                    <Badge tone="accent">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      instruct
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <dl className="text-xs text-muted-foreground">
                    <div>Download: {bytes(m.download_bytes)}</div>
                    <div>Est. RAM: {bytes(m.est_ram_bytes)}</div>
                  </dl>
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      size="sm"
                      onClick={() => download.mutate(m.hf_repo_id)}
                      disabled={download.isPending && download.variables === m.hf_repo_id}
                    >
                      {download.isSuccess && download.variables === m.hf_repo_id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {download.isPending && download.variables === m.hf_repo_id
                        ? "Starting…"
                        : "Download"}
                    </Button>
                    {download.variables === m.hf_repo_id && download.isSuccess && (
                      <Link to="/downloads" className="text-xs text-accent hover:underline">
                        Added — view in Downloads →
                      </Link>
                    )}
                    {download.variables === m.hf_repo_id && download.isError && (
                      <span className="max-w-[12rem] text-right text-xs text-destructive">
                        {(download.error as Error)?.message || "Failed to start download"}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}

function FitBadge({ fit }: { fit?: Model["fit"] }) {
  switch (fit) {
    case "fits":
      return <Badge tone="green" title="Fits in available RAM right now">Fits</Badge>;
    case "tight":
      return (
        <Badge tone="amber" title="Exceeds free RAM but fits the machine after freeing memory">
          Tight
        </Badge>
      );
    case "too_big":
      return <Badge tone="red" title="Larger than this machine's usable RAM">Too big</Badge>;
    default:
      return <Badge tone="muted" title="Could not estimate this model's RAM">Unknown</Badge>;
  }
}

function Filter({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-muted")
      }
    >
      {label}
    </button>
  );
}
