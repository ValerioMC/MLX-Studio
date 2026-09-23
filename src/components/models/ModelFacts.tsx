import { Eye } from "lucide-react";
import { Tag } from "@/components/ui/primitives";
import { params } from "@/lib/format";
import type { Model } from "@/types";

/** Size, quantization and capabilities, as tags; nothing when none are known. */
export function ModelFacts({ model, showInstruct = false }: { model: Model; showInstruct?: boolean }) {
  const instruct = showInstruct && model.instruct;
  if (model.params_b == null && !model.quantization && !model.vision && !instruct) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {model.params_b != null && <Tag>{params(model.params_b)}</Tag>}
      {model.quantization && <Tag>{model.quantization}</Tag>}
      {model.vision && (
        <Tag tone="accent">
          <Eye aria-hidden />
          Vision
        </Tag>
      )}
      {instruct && <Tag>Instruct</Tag>}
    </span>
  );
}
