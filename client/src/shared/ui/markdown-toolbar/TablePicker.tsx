import { useState, useRef, useEffect, useCallback } from "react";
import { Table } from "lucide-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useI18n } from "@/shared/i18n";
import { usePopoverAlignment } from "@/shared/hooks/usePopoverAlignment";
import { generateMarkdownTable, GRID_SIZE } from "@/shared/lib/markdown-toolbar-utils";

interface TablePickerProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  applyInsert: (text: string) => void;
}

export function TablePicker({ isOpen, onToggle, onClose, applyInsert }: TablePickerProps) {
  const { t } = useI18n();
  const { alignPopover } = usePopoverAlignment();
  const tableRef = useRef<HTMLDivElement>(null);
  const tablePopoverRef = useRef<HTMLDivElement>(null);

  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const [tableInput, setTableInput] = useState({ rows: 3, cols: 3 });
  const [isTouchDevice] = useState(() => typeof window !== "undefined" && "ontouchstart" in window);

  useClickOutside(tableRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      alignPopover(tablePopoverRef.current, tableRef.current);
    }
  }, [isOpen, alignPopover]);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { rows, cols } = tableHover;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setTableHover({ rows: rows || 1, cols: Math.min((cols || 0) + 1, GRID_SIZE) });
          break;
        case "ArrowLeft":
          e.preventDefault();
          setTableHover({ rows: rows || 1, cols: Math.max((cols || 1) - 1, 1) });
          break;
        case "ArrowDown":
          e.preventDefault();
          setTableHover({ rows: Math.min((rows || 0) + 1, GRID_SIZE), cols: cols || 1 });
          break;
        case "ArrowUp":
          e.preventDefault();
          setTableHover({ rows: Math.max((rows || 1) - 1, 1), cols: cols || 1 });
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (rows > 0 && cols > 0) {
            applyInsert(generateMarkdownTable(rows, cols));
            onClose();
            setTableHover({ rows: 0, cols: 0 });
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          setTableHover({ rows: 0, cols: 0 });
          break;
      }
    },
    [tableHover, applyInsert, onClose],
  );

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  return (
    <div ref={tableRef} className="relative">
      <button
        type="button"
        title={t("toolbar_table")}
        aria-label={t("toolbar_table")}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={onToggle}
        className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
      >
        <Table className="h-4 w-4" />
      </button>
      {isOpen && (
        <div
          ref={tablePopoverRef}
          className="border-border bg-surface absolute top-full z-50 mt-1 rounded-lg border p-2 shadow-lg"
          role="dialog"
          aria-label={t("toolbar_table_grid")}
        >
          {isTouchDevice ? (
            <div className="flex flex-col gap-2" style={{ minWidth: 160 }}>
              <label className="text-text-secondary flex items-center justify-between gap-2 text-xs">
                {t("toolbar_table_rows")}
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={tableInput.rows}
                  onChange={(e) => {
                    setTableInput((prev) => ({
                      ...prev,
                      rows: clamp(Number(e.target.value) || 1, 1, 8),
                    }));
                  }}
                  className="border-border bg-background text-text w-14 rounded border px-1.5 py-0.5 text-sm"
                />
              </label>
              <label className="text-text-secondary flex items-center justify-between gap-2 text-xs">
                {t("toolbar_table_cols")}
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={tableInput.cols}
                  onChange={(e) => {
                    setTableInput((prev) => ({
                      ...prev,
                      cols: clamp(Number(e.target.value) || 1, 1, 8),
                    }));
                  }}
                  className="border-border bg-background text-text w-14 rounded border px-1.5 py-0.5 text-sm"
                />
              </label>
              <div className="text-text-secondary text-center text-xs">
                {tableInput.rows} &times; {tableInput.cols}
              </div>
              <button
                type="button"
                className="bg-primary hover:bg-primary/90 rounded px-2 py-1 text-sm text-white transition-colors"
                onClick={() => {
                  applyInsert(generateMarkdownTable(tableInput.rows, tableInput.cols));
                  onClose();
                }}
              >
                {t("toolbar_table_insert")}
              </button>
            </div>
          ) : (
            <div>
              <div
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
                role="grid"
                aria-label={t("toolbar_table_select_size")}
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
              >
                {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
                  const r = Math.floor(i / GRID_SIZE) + 1;
                  const c = (i % GRID_SIZE) + 1;
                  const highlighted = r <= tableHover.rows && c <= tableHover.cols;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`h-4 w-4 rounded-sm border transition-colors ${
                        highlighted
                          ? "bg-primary/30 border-primary"
                          : "border-border bg-background hover:border-text-secondary"
                      }`}
                      aria-label={`${r} × ${c}`}
                      onMouseEnter={() => {
                        setTableHover({ rows: r, cols: c });
                      }}
                      onClick={() => {
                        applyInsert(generateMarkdownTable(r, c));
                        onClose();
                        setTableHover({ rows: 0, cols: 0 });
                      }}
                    />
                  );
                })}
              </div>
              <div
                className="text-text-secondary mt-1.5 text-center text-xs"
                onMouseLeave={() => {
                  setTableHover({ rows: 0, cols: 0 });
                }}
              >
                {tableHover.rows > 0 && tableHover.cols > 0
                  ? `${tableHover.rows} × ${tableHover.cols}`
                  : t("toolbar_table_select_size")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
