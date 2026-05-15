import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Upload,
  Users,
  Briefcase,
  Layers,
  Star,
  Award,
  TrendingUp,
  Trash2,
  FileSpreadsheet,
  Lock,
} from "lucide-react";
import eandLogo from "@/assets/eand-logo.png";
import { BUILTIN_DATASET } from "@/lib/builtin-dataset";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aggregate,
  clearDataset,
  loadDataset,
  parseWorkbook,
  saveDataset,
  type ResourceRow,
  type DatasetMeta,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "NOC Resource Delivery — Executive Dashboard" },
      {
        name: "description",
        content:
          "Executive overview of NOC & FM resource delivery: headcount, project allocation, performance scores and succession readiness.",
      },
    ],
  }),
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function Dashboard() {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = loadDataset();
    if (d) {
      setRows(d.rows);
      setMeta(d.meta);
    }
  }, []);

  const agg = useMemo(() => aggregate(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (scoreFilter !== "all") {
        if (scoreFilter === "na") {
          if (r.score != null) return false;
        } else if (Math.round(r.score ?? -1) !== Number(scoreFilter)) {
          return false;
        }
      }
      if (!q) return true;
      return [r.employeeName, r.employeeNumber, r.team, r.project, r.designation, r.targetRole]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, search, scoreFilter]);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      if (!parsed.length) throw new Error("No rows detected. Check the sheet headers.");
      const newMeta: DatasetMeta = {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        rowCount: parsed.length,
      };
      setRows(parsed);
      setMeta(newMeta);
      saveDataset({ meta: newMeta, rows: parsed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    clearDataset();
    setRows([]);
    setMeta(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary/30 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 relative">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary via-destructive to-primary" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                Executive Dashboard
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                NOC &amp; FM Resource Delivery
              </h1>
              {meta && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
                  {meta.fileName} · {meta.rowCount} records · uploaded{" "}
                  {new Date(meta.uploadedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Processing…" : meta ? "Upload new sheet" : "Upload sheet"}
            </Button>
            {meta && (
              <Button variant="outline" onClick={reset}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!rows.length ? (
          <EmptyState onUpload={() => fileRef.current?.click()} />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Total Resources" value={agg.total} icon={Users} />
              <Kpi label="Teams" value={agg.teams} icon={Layers} />
              <Kpi label="Sub Teams" value={agg.projects} icon={Briefcase} />
              <Kpi
                label="Avg Score"
                value={agg.avgScore ? agg.avgScore.toFixed(2) : "—"}
                icon={Star}
                hint={`${agg.scored}/${agg.total} scored`}
              />
              <Kpi
                label="Top Performers"
                value={agg.topPerformers}
                icon={TrendingUp}
                hint="Score ≥ 4"
                tone="success"
              />
              <Kpi
                label="Succession Pool"
                value={agg.successors}
                icon={Award}
                tone="warning"
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Headcount by Team">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agg.byTeam} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {agg.byTeam.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "var(--color-foreground)", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Performance Score Distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agg.scoreDist} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {agg.scoreDist.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "var(--color-foreground)", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Allocation by Sub Team (Top 10)">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={agg.byProject} layout="vertical" margin={{ top: 8, right: 36, left: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} width={130} />
                    <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {agg.byProject.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "var(--color-foreground)", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Designation Mix">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={agg.byDesignation}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={110}
                      paddingAngle={2}
                      label={({ value }) => value}
                      labelLine={false}
                    >
                      {agg.byDesignation.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-2">
                  {agg.byDesignation.map((d, i) => (
                    <Badge key={d.name} variant="secondary" className="font-normal">
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {d.name} · {d.value}
                    </Badge>
                  ))}
                </div>
              </ChartCard>
            </section>

            <section>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-base">
                    Resource Roster
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({filtered.length} of {rows.length})
                    </span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={scoreFilter} onValueChange={setScoreFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter score" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scores</SelectItem>
                        <SelectItem value="5">Score 5</SelectItem>
                        <SelectItem value="4">Score 4</SelectItem>
                        <SelectItem value="3">Score 3</SelectItem>
                        <SelectItem value="2">Score 2</SelectItem>
                        <SelectItem value="1">Score 1</SelectItem>
                        <SelectItem value="na">Not scored</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Search name, team…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[520px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>Sub Team</TableHead>
                          <TableHead>Target Role</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead>Succession</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r, i) => (
                          <TableRow key={`${r.employeeNumber}-${i}`}>
                            <TableCell>
                              <div className="font-medium">{r.employeeName}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.employeeNumber}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.team || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{r.designation}</TableCell>
                            <TableCell className="text-sm">{r.project}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.targetRole || "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              <ScorePill score={r.score} />
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.succession ? (
                                <Badge className="bg-warning/20 text-foreground hover:bg-warning/20">
                                  {r.succession}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!filtered.length && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                              No matching records.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
};

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    score >= 4
      ? "bg-success/15 text-success"
      : score >= 3
        ? "bg-warning/20 text-foreground"
        : "bg-destructive/15 text-destructive";
  return (
    <span className={`inline-flex h-7 w-9 items-center justify-center rounded-md text-sm font-semibold ${tone}`}>
      {score}
    </span>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-secondary p-4">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Upload a resource delivery sheet</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Drop in your NOC / FM resource Excel file. The dashboard refreshes
          automatically each time you upload a new version.
        </p>
        <Button className="mt-6" onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" /> Choose .xlsx file
        </Button>
      </CardContent>
    </Card>
  );
}
