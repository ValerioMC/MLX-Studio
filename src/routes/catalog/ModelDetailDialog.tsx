import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Heart } from "lucide-react";
import { api } from "@/lib/api/client";
import { bytes, compactNumber } from "@/lib/format";
import { openExternal } from "@/lib/openExternal";
import { ModelFacts } from "@/components/models/ModelFacts";
import { Dialog } from "@/components/ui/Dialog";
import { Tag } from "@/components/ui/primitives";
import { DownloadButton } from "./DownloadButton";
import type { CatalogModel } from "@/types";

// The Markdown renderer and its highlighter load when a model card first opens,
// not with the catalog.
const Markdown = lazy(() => import("@/components/chat/Markdown").then((m) => ({ default: m.Markdown })));

function CardSkeleton() {
  return (
    <div className="space-y-2" aria-busy>
      {[88, 72, 94, 60].map((w) => (
        <div key={w} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

interface RepoDetail {
  hf_repo_id: string;
  license: string | null;
  downloads: number;
  likes: number;
  readme: string | null;
}

/** Strips the YAML front matter model cards start with. */
function cardBody(readme: string): string {
  return readme.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

export function ModelDetailDialog({ model, onClose }: { model: CatalogModel; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["catalog-detail", model.hf_repo_id],
    queryFn: () => api<RepoDetail>(`/catalog/detail?repo_id=${encodeURIComponent(model.hf_repo_id)}`),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Dialog
      title={model.display_name}
      description={<span className="selectable font-mono text-xs">{model.hf_repo_id}</span>}
      onClose={onClose}
      className="h-[80vh] w-[48rem]"
      footer={
        <>
          <button
            type="button"
            onClick={() => void openExternal(`https://huggingface.co/${model.hf_repo_id}`)}
            className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open on Hugging Face
          </button>
          <DownloadButton repoId={model.hf_repo_id} />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-4 text-sm text-muted-foreground">
        <ModelFacts model={model} />
        <span className="tabular">Needs about {bytes(model.est_ram_bytes)}</span>
        {data && <span className="tabular">{compactNumber(data.downloads)} downloads</span>}
        {data && (
          <span className="tabular inline-flex items-center gap-1">
            <Heart className="h-3 w-3" aria-hidden />
            {compactNumber(data.likes)}
          </span>
        )}
        {data?.license && <Tag>License: {data.license}</Tag>}
      </div>

      <div className="selectable border-t pt-4">
        {isLoading && <CardSkeleton />}
        {isError && <p className="text-sm text-muted-foreground">Could not load the model card from Hugging Face.</p>}
        {data &&
          (data.readme ? (
            <Suspense fallback={<CardSkeleton />}>
              <Markdown content={cardBody(data.readme)} />
            </Suspense>
          ) : (
            <p className="text-sm text-muted-foreground">This model has no model card.</p>
          ))}
      </div>
    </Dialog>
  );
}
