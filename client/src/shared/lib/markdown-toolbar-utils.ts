export function generateMarkdownTable(rows: number, cols: number): string {
  const header = Array.from({ length: cols }, (_, i) => ` Header ${i + 1} `).join("|");
  const separator = Array.from({ length: cols }, () => " --- ").join("|");
  const emptyRow = Array.from({ length: cols }, () => "  ").join("|");
  const dataRows = Array.from({ length: rows - 1 }, () => `|${emptyRow}|`).join("\n");
  return `|${header}|\n|${separator}|\n${dataRows}\n`;
}

export const PRESET_COLORS_DARK = [
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#64748b",
];

export const PRESET_COLORS_LIGHT = [
  "#fecaca",
  "#fed7aa",
  "#fef08a",
  "#bbf7d0",
  "#a5f3fc",
  "#bfdbfe",
  "#ddd6fe",
  "#e2e8f0",
];

export const GRID_SIZE = 8;
