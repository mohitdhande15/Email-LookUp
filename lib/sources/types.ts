export type SourceId = "gravatar" | "github" | "breach";

export interface SourceResult {
  source: SourceId;
  status: "found" | "not_found" | "error" | "skipped";
  data?: Record<string, unknown>;
  message?: string;
}
