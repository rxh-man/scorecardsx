import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Aggregates, ResourceRow, DatasetMeta } from "./dashboard-data";

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(rows: ResourceRow[], agg: Aggregates, meta: DatasetMeta | null) {
  const lines: string[] = [];
  lines.push("NOC & FM Resource Delivery — Audit Export");
  lines.push(`Generated,${new Date().toLocaleString()}`);
  if (meta) lines.push(`Source,${meta.fileName},${meta.rowCount} records,uploaded ${new Date(meta.uploadedAt).toLocaleString()}`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`Total Resources,${agg.total}`);
  lines.push(`Teams,${agg.teams}`);
  lines.push(`Sub Teams,${agg.projects}`);
  lines.push(`Scored,${agg.scored}/${agg.total}`);
  lines.push(`Average Score,${agg.avgScore ? agg.avgScore.toFixed(2) : "—"}`);
  lines.push(`Top Performers (Score >=4),${agg.topPerformers}`);
  lines.push(`Succession Pool,${agg.successors}`);
  lines.push(`Missing Scores,${agg.missingScoreRows.length}`);
  lines.push("");
  lines.push("HEADCOUNT BY TEAM");
  lines.push("Team,Count");
  agg.byTeam.forEach((t) => lines.push(`${csvEscape(t.name)},${t.value}`));
  lines.push("");
  lines.push("SUCCESSION RISK (target role with score < 3)");
  lines.push("Employee,Number,Team,Current Role,Target Role,Score");
  agg.successionRiskRows.forEach((r) =>
    lines.push([r.employeeName, r.employeeNumber, r.team, r.designation, r.targetRole, r.score]
      .map(csvEscape).join(",")),
  );
  lines.push("");
  lines.push("FULL ROSTER");
  lines.push("Employee,Number,Team,Designation,Sub Team,Target Role,Score,Succession");
  rows.forEach((r) =>
    lines.push([r.employeeName, r.employeeNumber, r.team, r.designation, r.project,
      r.targetRole, r.score ?? "N/A", r.succession ?? ""].map(csvEscape).join(",")),
  );

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `noc-audit-${stamp()}.csv`);
}

export function exportPDF(rows: ResourceRow[], agg: Aggregates, meta: DatasetMeta | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("NOC & FM Resource Delivery — Audit View", 40, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 66);
  if (meta) {
    doc.text(`Source: ${meta.fileName} · ${meta.rowCount} records`, 40, 78);
  }
  doc.setTextColor(0);

  // Confidentiality banner
  doc.setFillColor(252, 232, 232);
  doc.rect(40, 90, w - 80, 22, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(176, 0, 32);
  doc.text("CONFIDENTIAL — e& internal use only.", 48, 105);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text("Restricted workforce information. Limited to recipients of the private link.", 220, 105);
  doc.setTextColor(0);

  // KPI summary table
  autoTable(doc, {
    startY: 124,
    head: [["Metric", "Value"]],
    body: [
      ["Total Resources", agg.total],
      ["Teams", agg.teams],
      ["Sub Teams", agg.projects],
      ["Scored", `${agg.scored} / ${agg.total}`],
      ["Average Score", agg.avgScore ? agg.avgScore.toFixed(2) : "—"],
      ["Top Performers (Score ≥ 4)", agg.topPerformers],
      ["Succession Pool", agg.successors],
      ["Missing Scores (entries missing from leaders)", agg.missingScoreRows.length],
    ],
    theme: "grid",
    headStyles: { fillColor: [176, 0, 32], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    head: [["Team", "Headcount"]],
    body: agg.byTeam.map((t) => [t.name, t.value]),
    theme: "grid",
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {},
  });

  if (agg.successionRiskRows.length) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Succession Risk — Target Role with Score < 3", 40, 50);
    autoTable(doc, {
      startY: 60,
      head: [["Employee", "Number", "Team", "Current Role", "Target Role", "Score"]],
      body: agg.successionRiskRows.map((r) => [
        r.employeeName, r.employeeNumber, r.team, r.designation, r.targetRole, r.score ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [176, 0, 32], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 40, right: 40 },
    });
  }

  doc.addPage();
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Full Resource Roster", 40, 50);
  autoTable(doc, {
    startY: 60,
    head: [["Employee", "Number", "Team", "Designation", "Sub Team", "Target Role", "Score", "Succession"]],
    body: rows.map((r) => [
      r.employeeName, r.employeeNumber, r.team, r.designation, r.project,
      r.targetRole || "—", r.score ?? "N/A", r.succession ?? "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 30, right: 30 },
    columnStyles: { 0: { cellWidth: 90 }, 3: { cellWidth: 80 }, 5: { cellWidth: 80 }, 7: { cellWidth: 70 } },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pageCount} · Confidential`, w - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  doc.save(`noc-audit-${stamp()}.pdf`);
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
