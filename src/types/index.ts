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
  status: "available" | "downloading" | "installed" | "running" | "error";
  fit?: "fits" | "tight" | "too_big" | "unknown" | null;
  chat_capable?: boolean;
}

export interface DownloadJob {
  id: string;
  hf_repo_id: string;
  status: "queued" | "downloading" | "paused" | "completed" | "failed" | "canceled";
  total_bytes?: number | null;
  downloaded_bytes: number;
  speed_bps?: number | null;
  error?: string | null;
}

export interface SystemStats {
  ram_total: number;
  ram_used: number;
  ram_available: number;
  swap_used: number;
  cpu_percent: number;
  disk_free: number;
  loaded_models: { model_id: string; context_length: number }[];
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
