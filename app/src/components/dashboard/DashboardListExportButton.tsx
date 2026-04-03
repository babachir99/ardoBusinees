"use client";

type DashboardListExportButtonProps = {
  filename: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null | undefined>>;
  label?: string;
  disabledLabel?: string;
};

function escapeCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).replace(/"/g, "\"\"");
  return /[";\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

export default function DashboardListExportButton({
  filename,
  columns,
  rows,
  label = "Exporter CSV",
  disabledLabel = "Aucune donnee",
}: DashboardListExportButtonProps) {
  const disabled = rows.length === 0;

  const handleExport = () => {
    if (disabled) return;

    const header = columns.map((column) => escapeCsvValue(column.label)).join(";");
    const contentRows = rows.map((row) =>
      columns.map((column) => escapeCsvValue(row[column.key])).join(";")
    );
    const blob = new Blob(["\uFEFF", [header, ...contentRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"
          : "border-white/20 bg-zinc-950/60 text-zinc-200 hover:border-white/40 hover:text-white"
      }`}
    >
      {disabled ? disabledLabel : label}
    </button>
  );
}
