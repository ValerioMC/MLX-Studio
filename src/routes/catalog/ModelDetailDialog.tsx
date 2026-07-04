import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Markdown } from "@/components/chat/Markdown";
import type { Model } from "@/types";
import { Download, Heart, X } from "lucide-react";

interface RepoDetail {
  hf_repo_id: string;
  license: string | null;
  downloads: number;
  likes: number;
  readme: string | null;
}

export function ModelDetailDialog({
  model,
  onClose,
  onDownload,
}: {
  model: Model;
  onClose: () => void;
  onDownload: (repoId: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["catalog-detail", model.hf_repo_id],
    queryFn: () => api<RepoDetail>(`/catalog/detail?repo_id=${encodeURIComponent(model.hf_repo_id)}`),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[85vh] w-[44rem] max-w-[92vw] flex-col space-y-3 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">{model.display_name}</h2>
            <p className="text-xs text-muted-foreground">{model.hf_repo_id}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={() => {
                onDownload(model.hf_repo_id);
                onClose();
              }}
            >
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data?.license && <Badge tone="accent">license: {data.license}</Badge>}
          {data != null && <Badge>{data.downloads.toLocaleString()} downloads</Badge>}
          {data != null && (
            <Badge>
              <Heart className="mr-1 h-3 w-3" />
              {data.likes.toLocaleString()}
            </Badge>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading model card…</p>}
          {isError && (
            <p className="text-sm text-muted-foreground">
              Could not load the model card from Hugging Face.
            </p>
          )}
          {data && (data.readme ? <Markdown content={data.readme} /> : (
            <p className="text-sm text-muted-foreground">This model has no README.</p>
          ))}
        </div>
      </Card>
    </div>
  );
}
