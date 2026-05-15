import type { ResourceRow, StoredDataset } from "./dashboard-data";

/**
 * Built-in dataset baked into the published site.
 * Replace `BUILTIN_ROWS` with the real records (or run a one-time
 * "Save to site" action) so that the dashboard renders without any
 * upload after deployment.
 */
export const BUILTIN_ROWS: ResourceRow[] = [];

export const BUILTIN_DATASET: StoredDataset | null = BUILTIN_ROWS.length
  ? {
      meta: {
        fileName: "NOC & FM Resource Delivery (built-in)",
        uploadedAt: "2026-05-15T00:00:00.000Z",
        rowCount: BUILTIN_ROWS.length,
      },
      rows: BUILTIN_ROWS,
    }
  : null;
