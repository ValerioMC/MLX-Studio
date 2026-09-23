import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { bytes, compactNumber } from "@/lib/format";
import { ModelFacts } from "@/components/models/ModelFacts";
import { Button, EmptyState, InlineError, Kbd, PageHeader, Tag, fieldClass } from "@/components/ui/primitives";
import { ModelDetailDialog } from "./ModelDetailDialog";
import { DownloadButton } from "./DownloadButton";
import type { CatalogModel, CatalogSort, Fit } from "@/types";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

interface CatalogPage {
  items: CatalogModel[];
  budget_bytes: number;
  total_usable_bytes: number;
}

type Quant = "4bit" | "8bit";

interface Filters {
  quant: Quant | null;
  vision: boolean;
  instruct: boolean;
  fitsOnly: boolean;
}

const SORT_OPTIONS: readonly { value: CatalogSort; label: string }[] = [
  { value: "downloads", label: "Most downloaded" },
  { value: "likes", label: "Most liked" },
  { value: "recent", label: "Recently updated" },
];

const FIT_TEXT: Record<Fit, { label: string; tone: "positive" | "caution" | "danger" | "neutral"; title: string }> = {
  fits: { label: "Fits", tone: "positive", title: "Fits in free memory right now" },
  tight: { label: "Tight", tone: "caution", title: "Needs more than is free now, but fits once memory is reclaimed" },
  too_big: { label: "Too big", tone: "danger", title: "Larger than this Mac's usable memory" },
  unknown: { label: "Unknown", tone: "neutral", title: "Size could not be estimated from the name" },
};

const FIT_BAR: Record<Fit, string> = {
  fits: "bg-positive",
  tight: "bg-caution",
  too_big: "bg-destructive",
  unknown: "bg-muted-foreground",
};

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "no-drag h-7 rounded-md px-2.5 text-sm font-medium transition-colors",
        active ? "bg-accent/12 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** Memory this model needs, drawn against everything this Mac can give a model. */
function FitMeter({ model, usableBytes }: { model: CatalogModel; usableBytes: number }) {
  const fit = model.fit ?? "unknown";
  const share = model.est_ram_bytes && usableBytes ? Math.min(model.est_ram_bytes / usableBytes, 1) : 0;
  const text = FIT_TEXT[fit];
  return (
    <div className="flex w-[9.5rem] flex-col gap-1" title={text.title}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="tabular">{bytes(model.est_ram_bytes)}</span>
        <Tag tone={text.tone}>{text.label}</Tag>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", FIT_BAR[fit])} style={{ width: `${Math.max(share * 100, 2)}%` }} />
      </div>
    </div>
  );
}

export function CatalogView() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>("downloads");
  const [filters, setFilters] = useState<Filters>({ quant: null, vision: false, instruct: false, fitsOnly: false });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [detailTarget, setDetailTarget] = useState<CatalogModel | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A new question starts from the first page.
  useEffect(() => setLimit(PAGE_SIZE), [debouncedQuery, sort, filters.quant, filters.vision, filters.instruct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data, isFetching, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ["catalog", debouncedQuery, sort, filters.quant, filters.vision, filters.instruct, limit],
    queryFn: () => {
      const p = new URLSearchParams({ limit: String(limit), sort });
      if (debouncedQuery) p.set("q", debouncedQuery);
      if (filters.quant) p.set("quant", filters.quant);
      if (filters.vision) p.set("vision", "true");
      if (filters.instruct) p.set("instruct", "true");
      return api<CatalogPage>(`/catalog/search?${p}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const items = (data?.items ?? []).filter((m) => !filters.fitsOnly || m.fit === "fits");
  const toggle = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const mayHaveMore = (data?.items.length ?? 0) >= limit;

  return (
    <div>
      <PageHeader title="Catalog">
        <span className="text-sm text-muted-foreground">MLX conversions from Hugging Face</span>
      </PageHeader>

      <div className="sticky top-0 z-10 -mx-2 flex flex-col gap-2.5 bg-background/95 px-2 pb-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search models, like qwen, llama or gemma"
            aria-label="Search models"
            className={cn(fieldClass, "h-9 pl-8 pr-16")}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <Button variant="ghost" size="icon-sm" aria-label="Clear search" onClick={() => setQuery("")}>
                <X />
              </Button>
            ) : (
              <Kbd>⌘F</Kbd>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Chip label="4-bit" active={filters.quant === "4bit"} onClick={() => toggle({ quant: filters.quant === "4bit" ? null : "4bit" })} />
          <Chip label="8-bit" active={filters.quant === "8bit"} onClick={() => toggle({ quant: filters.quant === "8bit" ? null : "8bit" })} />
          <Chip label="Vision" active={filters.vision} onClick={() => toggle({ vision: !filters.vision })} />
          <Chip label="Instruct" active={filters.instruct} onClick={() => toggle({ instruct: !filters.instruct })} />
          <span aria-hidden className="mx-1.5 h-4 w-px bg-border" />
          <Chip label="Fits this Mac" active={filters.fitsOnly} onClick={() => toggle({ fitsOnly: !filters.fitsOnly })} />
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CatalogSort)}
              className={cn(fieldClass, "h-7 w-auto pr-7 text-sm")}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isError && (
        <InlineError className="mb-4 flex items-center justify-between gap-4">
          <span>Could not reach Hugging Face: {error.message}</span>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </InlineError>
      )}

      {!data && isFetching ? (
        <ul className="divide-y border-y" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-56 animate-pulse rounded bg-muted" />
                <div className="h-3 w-80 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 && data ? (
        <EmptyState title={debouncedQuery ? `Nothing matches “${debouncedQuery}”` : "No models match these filters"}>
          {filters.fitsOnly
            ? "None of these fit in free memory right now. Turn off “Fits this Mac” to see models that fit once memory is reclaimed."
            : "Try a family name like qwen, llama, mistral or gemma, or clear a filter."}
        </EmptyState>
      ) : (
        <ul className={cn("divide-y border-y transition-opacity", isPlaceholderData && "opacity-60")}>
          {items.map((m) => (
            <li key={m.hf_repo_id} className="flex items-center gap-5 py-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setDetailTarget(m)}
                  className="max-w-full truncate text-left text-md font-medium hover:text-accent"
                >
                  {m.display_name}
                </button>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
                  <ModelFacts model={m} showInstruct />
                  <span className="tabular" title="Downloads in the last 30 days">
                    {compactNumber(m.downloads_30d ?? 0)} downloads
                  </span>
                  {sort === "likes" && <span className="tabular">{compactNumber(m.likes ?? 0)} likes</span>}
                </div>
              </div>
              <FitMeter model={m} usableBytes={data?.total_usable_bytes ?? 0} />
              <div className="flex w-[9.5rem] justify-end">
                <DownloadButton repoId={m.hf_repo_id} quiet />
              </div>
            </li>
          ))}
        </ul>
      )}

      {mayHaveMore && items.length > 0 && (
        <div className="flex justify-center pt-5">
          <Button variant="secondary" loading={isFetching} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show more
          </Button>
        </div>
      )}

      {detailTarget && <ModelDetailDialog model={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}
