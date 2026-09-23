export type ModelStatus = "available" | "downloading" | "installed" | "running" | "error";
export type Fit = "fits" | "tight" | "too_big" | "unknown";

export interface Model {
  id: string;
  hf_repo_id: string;
  display_name: string;
  params_b?: number | null;
  quantization?: string | null;
  context_length?: number | null;
  vision?: boolean;
  instruct?: boolean;
  download_bytes?: number | null;
  est_ram_bytes?: number | null;
  description?: string | null;
  status: ModelStatus;
  fit?: Fit | null;
  chat_capable?: boolean;
}

/** A catalog search result: a model on the Hub, with popularity figures. */
export interface CatalogModel extends Model {
  downloads_30d?: number | null;
  likes?: number | null;
  last_modified?: string | null;
}

export type CatalogSort = "downloads" | "likes" | "recent";

export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed" | "canceled";

export interface DownloadJob {
  id: string;
  hf_repo_id: string;
  status: DownloadStatus;
  total_bytes?: number | null;
  downloaded_bytes: number;
  speed_bps?: number | null;
  error?: string | null;
}

export interface LoadedModel {
  model_id: string;
  context_length: number;
  est_ram_bytes?: number | null;
  /** Palette slot the sidecar gave this model at load; fixed while it stays loaded. */
  tone?: number;
  loaded_at?: number;
}

export interface SystemStats {
  ram_total: number;
  ram_used: number;
  ram_available: number;
  swap_used: number;
  cpu_percent: number;
  disk_free: number;
  reserve_bytes?: number;
  loaded_models: LoadedModel[];
}

export interface Activity {
  kind: string;
  model_id?: string | null;
  message: string;
  at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  model_id: string | null;
  updated_at: string;
}

export interface MemoryEstimate {
  context_length: number;
  est_ram_bytes: number | null;
  weight_bytes?: number;
  kv_cache_bytes?: number;
  overhead_bytes?: number;
  fit: Fit;
  budget_bytes: number;
  total_usable_bytes: number;
  max_context?: number | null;
}
