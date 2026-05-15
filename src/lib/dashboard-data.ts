import * as XLSX from "xlsx";

export interface ResourceRow {
  sl?: number | string;
  team: string;
  employeeNumber: string;
  employeeName: string;
  designation: string;
  responsibilities: string;
  project: string;
  targetRole: string;
  score: number | null;
  succession: string | null;
}

export interface DatasetMeta {
  fileName: string;
  uploadedAt: string;
  rowCount: number;
}

const STORAGE_KEY = "noc-dashboard-data-v1";

const norm = (k: string) => k.trim().toLowerCase().replace(/[\s_]+/g, "");

const PICK = (row: Record<string, unknown>, ...keys: string[]) => {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const k of keys) {
    const v = map[norm(k)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
};

export function parseWorkbook(buffer: ArrayBuffer): ResourceRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  return json
    .map((r) => {
      const scoreRaw = PICK(r, "Score (1-5)", "Score", "Rating");
      const score = scoreRaw == null || scoreRaw === "" ? null : Number(scoreRaw);
      return {
        sl: PICK(r, "SL", "S.No", "No") as number | string,
        team: String(PICK(r, "Team") ?? "").trim(),
        employeeNumber: String(PICK(r, "Employee Number", "Emp No", "Emp ID") ?? "").trim(),
        employeeName: String(PICK(r, "Employee Name", "Name") ?? "").trim(),
        designation: String(PICK(r, "Designation", "Title") ?? "").trim(),
        responsibilities: String(PICK(r, "Roles & Responsibilities", "Responsibilities") ?? "").trim(),
        project: String(PICK(r, "Project") ?? "").trim() || "Unassigned",
        targetRole: String(PICK(r, "Target Role") ?? "").trim(),
        score: Number.isFinite(score as number) ? (score as number) : null,
        succession: (() => {
          const v = PICK(r, "Sucession", "Succession");
          return v ? String(v).trim() : null;
        })(),
      };
    })
    .filter((r) => r.employeeName);
}

export interface StoredDataset {
  meta: DatasetMeta;
  rows: ResourceRow[];
}

export function saveDataset(d: StoredDataset) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

export function loadDataset(): StoredDataset | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDataset;
  } catch {
    return null;
  }
}

export function clearDataset() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export interface Aggregates {
  total: number;
  teams: number;
  projects: number;
  scored: number;
  avgScore: number;
  topPerformers: number; // score >=4
  successors: number;
  byTeam: { name: string; value: number }[];
  byProject: { name: string; value: number }[];
  byDesignation: { name: string; value: number }[];
  scoreDist: { name: string; value: number }[];
  avgScoreByTeam: { name: string; value: number; scored: number; missing: number }[];
  successionByTeam: { name: string; covered: number; missing: number; total: number }[];
  topByTeam: { name: string; value: number }[];
  topByDesignation: { name: string; value: number }[];
  successionRiskRows: ResourceRow[];
  missingScoreRows: ResourceRow[];
}

export function aggregate(rows: ResourceRow[]): Aggregates {
  const tally = (key: keyof ResourceRow) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = (r[key] as string) || "—";
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };
  const scored = rows.filter((r) => r.score != null);
  const scoreBuckets = new Map<string, number>();
  for (let i = 1; i <= 5; i++) scoreBuckets.set(String(i), 0);
  scoreBuckets.set("N/A", 0);
  for (const r of rows) {
    const k = r.score == null ? "N/A" : String(Math.round(r.score));
    scoreBuckets.set(k, (scoreBuckets.get(k) ?? 0) + 1);
  }
  // Average score by team (only counts scored entries; tracks missing)
  const teamMap = new Map<string, { sum: number; scored: number; missing: number }>();
  for (const r of rows) {
    const t = r.team || "—";
    const cur = teamMap.get(t) ?? { sum: 0, scored: 0, missing: 0 };
    if (r.score != null) {
      cur.sum += r.score;
      cur.scored += 1;
    } else {
      cur.missing += 1;
    }
    teamMap.set(t, cur);
  }
  const avgScoreByTeam = [...teamMap.entries()]
    .map(([name, v]) => ({
      name,
      value: v.scored ? Number((v.sum / v.scored).toFixed(2)) : 0,
      scored: v.scored,
      missing: v.missing,
    }))
    .sort((a, b) => b.value - a.value);

  // Succession coverage by team
  const succMap = new Map<string, { covered: number; missing: number }>();
  for (const r of rows) {
    const t = r.team || "—";
    const cur = succMap.get(t) ?? { covered: 0, missing: 0 };
    if (r.succession) cur.covered += 1;
    else cur.missing += 1;
    succMap.set(t, cur);
  }
  const successionByTeam = [...succMap.entries()]
    .map(([name, v]) => ({ name, ...v, total: v.covered + v.missing }))
    .sort((a, b) => b.total - a.total);

  // Top performers (score >=4) breakdowns
  const tops = rows.filter((r) => (r.score ?? 0) >= 4);
  const topByTeamMap = new Map<string, number>();
  const topByDesigMap = new Map<string, number>();
  for (const r of tops) {
    const t = r.team || "—";
    const d = r.designation || "—";
    topByTeamMap.set(t, (topByTeamMap.get(t) ?? 0) + 1);
    topByDesigMap.set(d, (topByDesigMap.get(d) ?? 0) + 1);
  }
  const topByTeam = [...topByTeamMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const topByDesignation = [...topByDesigMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Score vs Target Role gap — has a target role but score < 3 (succession risk)
  const successionRiskRows = rows
    .filter((r) => r.targetRole && r.score != null && r.score < 3)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  // Missing entries (no score) — flagged for leaders
  const missingScoreRows = rows.filter((r) => r.score == null);

  return {
    total: rows.length,
    teams: new Set(rows.map((r) => r.team).filter(Boolean)).size,
    projects: new Set(rows.map((r) => r.project).filter(Boolean)).size,
    scored: scored.length,
    avgScore: scored.length
      ? scored.reduce((s, r) => s + (r.score as number), 0) / scored.length
      : 0,
    topPerformers: tops.length,
    successors: rows.filter((r) => r.succession).length,
    byTeam: tally("team"),
    byProject: tally("project").slice(0, 10),
    byDesignation: tally("designation").slice(0, 8),
    scoreDist: [...scoreBuckets.entries()].map(([name, value]) => ({ name, value })),
    avgScoreByTeam,
    successionByTeam,
    topByTeam,
    topByDesignation,
    successionRiskRows,
    missingScoreRows,
  };
}
