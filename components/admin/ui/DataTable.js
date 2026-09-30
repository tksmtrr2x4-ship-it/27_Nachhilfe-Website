"use client";

import { useEffect, useRef, useState } from "react";

// Eine Tabelle für alle Admin-Listen.
//
// Warum nicht wie vorher: die bisherigen Tabellen brauchten min-w-[880…960px]
// und seitliches Scrollen, weil bis zu sieben Aktionslinks in der letzten
// Spalte standen. Hier liegen Aktionen außerhalb des Spaltenrasters (zwei
// direkt, der Rest hinter „…“), und unter sm wird jede Zeile zu einer Karte –
// dadurch scrollt nichts mehr seitlich.
//
// columns: [{ key, header, cell(row), align: "left"|"right", width, priority, hideBelowXl }]
//   priority "primary"   → Überschrift der Karte
//            "secondary" → Feldliste der Karte (Standard)
//            "meta"      → kleine graue Fußzeile der Karte
// actions: (row) => [{ label, onClick, tone, hidden, disabled, title }]
// groupBy: (row) => ({ key, label, summary })  → Zwischenüberschriften
export function DataTable({
  columns,
  rows,
  getRowKey,
  actions,
  groupBy,
  onRowClick,
  rowTone,
  empty = "Keine Einträge.",
  caption,
}) {
  const groups = buildGroups(rows, groupBy);
  if (!rows?.length) {
    return <p className="rounded-2xl border border-dashed border-[var(--ck-line)] p-6 text-center text-sm text-[var(--ck-muted)]">{empty}</p>;
  }

  return (
    <div>
      {caption ? <p className="mb-2 text-xs text-[var(--ck-muted)]">{caption}</p> : null}

      {/* Tabelle ab lg – darunter Karten, damit nichts seitlich scrollt */}
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--ck-line)] lg:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={col.width ? { width: col.width } : undefined} />
            ))}
            {actions ? <col style={{ width: "6.5rem" }} /> : null}
          </colgroup>
          <thead className="bg-[var(--ck-surface2)] text-xs uppercase tracking-wide text-[var(--ck-muted)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-2.5 font-semibold ${col.align === "right" ? "text-right" : ""} ${col.hideBelowXl ? "hidden xl:table-cell" : ""}`}
                >
                  {col.header}
                </th>
              ))}
              {actions ? <th scope="col" className="px-4 py-2.5 text-right font-semibold">Aktion</th> : null}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key} className="divide-y divide-[var(--ck-line)]">
              {group.label ? (
                <tr className="bg-[var(--ck-surface)]">
                  <th
                    colSpan={columns.length + (actions ? 1 : 0)}
                    scope="colgroup"
                    className="border-t border-[var(--ck-line)] px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ck-muted)]"
                  >
                    {group.label}
                    {group.summary ? <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ck-faint)]">{group.summary}</span> : null}
                  </th>
                </tr>
              ) : null}
              {group.rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={`align-top ${rowTone?.(row) === "red" ? "bg-[var(--ck-neg-soft)]" : "bg-[var(--ck-surface)]"} ${onRowClick ? "hover:bg-[var(--ck-surface2)]" : ""}`}
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.hideBelowXl ? "hidden xl:table-cell" : ""}`}
                    >
                      {onRowClick && i === 0 ? (
                        <button type="button" onClick={() => onRowClick(row)} className="text-left font-semibold text-[var(--ck-text)] hover:text-[var(--ck-accent)]">
                          {col.cell(row)}
                        </button>
                      ) : (
                        col.cell(row)
                      )}
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-4 py-3">
                      <RowActions actions={actions(row)} align="end" />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Karten unter lg */}
      <ul className="space-y-3 lg:hidden">
        {groups.map((group) => (
          <li key={group.key}>
            {group.label ? (
              <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--ck-muted)]">
                {group.label}
                {group.summary ? <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ck-faint)]">{group.summary}</span> : null}
              </p>
            ) : null}
            <ul className="space-y-3">
              {group.rows.map((row) => (
                <li key={getRowKey(row)} className={`rounded-2xl border p-4 ${rowTone?.(row) === "red" ? "border-[var(--ck-neg)]/35 bg-[var(--ck-neg-soft)]" : "border-[var(--ck-line)] bg-[var(--ck-surface)]"}`}>
                  {columns
                    .filter((col) => col.priority === "primary")
                    .map((col) => (
                      <div key={col.key} className="text-sm font-semibold text-[var(--ck-text)]">
                        {onRowClick ? (
                          <button type="button" onClick={() => onRowClick(row)} className="text-left hover:text-[var(--ck-accent)]">
                            {col.cell(row)}
                          </button>
                        ) : (
                          col.cell(row)
                        )}
                      </div>
                    ))}
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {columns
                      .filter((col) => !col.priority || col.priority === "secondary")
                      .map((col) => (
                        <div key={col.key} className="col-span-2 grid grid-cols-[7.5rem_1fr] gap-x-3">
                          <dt className="text-xs font-semibold text-[var(--ck-muted)]">{col.header}</dt>
                          <dd className="min-w-0 text-[var(--ck-text)]">{col.cell(row)}</dd>
                        </div>
                      ))}
                  </dl>
                  {columns.some((col) => col.priority === "meta") ? (
                    <p className="mt-2 text-xs text-[var(--ck-muted)]">
                      {columns
                        .filter((col) => col.priority === "meta")
                        .map((col) => (
                          <span key={col.key} className="mr-2">
                            {col.cell(row)}
                          </span>
                        ))}
                    </p>
                  ) : null}
                  {actions ? (
                    <div className="mt-3 border-t border-[var(--ck-line)] pt-3">
                      <RowActions actions={actions(row)} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildGroups(rows, groupBy) {
  if (!groupBy) return [{ key: "all", label: null, rows: rows || [] }];
  const groups = [];
  for (const row of rows || []) {
    const { key, label, summary } = groupBy(row) || {};
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label, summary, rows: [row] });
  }
  return groups;
}

// Bis zu zwei Aktionen direkt, der Rest hinter „…“.
export function RowActions({ actions, align = "start" }) {
  const visible = (actions || []).filter((a) => a && !a.hidden);
  if (visible.length === 0) return <span className="text-xs text-[var(--ck-faint)]">–</span>;
  const inline = visible.slice(0, 2);
  const rest = visible.slice(2);
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${align === "end" ? "sm:justify-end" : ""}`}>
      {inline.map((action) => (
        <ActionLink key={action.label} action={action} />
      ))}
      {rest.length > 0 ? <ActionMenu actions={rest} /> : null}
    </div>
  );
}

function ActionLink({ action }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.title}
      className={`rounded-full px-2 py-1 text-xs font-semibold disabled:opacity-40 ${
        action.tone === "red"
          ? "text-[var(--ck-neg)] hover:bg-[var(--ck-neg-soft)]"
          : action.tone === "emerald"
            ? "text-[var(--ck-pos)] hover:bg-[var(--ck-pos-soft)]"
            : "text-[var(--ck-accent)] hover:bg-[var(--ck-accent-soft)]"
      }`}
    >
      {action.label}
    </button>
  );
}

function ActionMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Weitere Aktionen"
        className="rounded-full px-2 py-1 text-sm font-semibold text-[var(--ck-muted)] hover:bg-[var(--ck-surface2)]"
      >
        …
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-[var(--ck-line)] bg-[var(--ck-surface)] p-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setOpen(false);
                action.onClick?.();
              }}
              disabled={action.disabled}
              title={action.title}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40 ${
                action.tone === "red" ? "text-[var(--ck-neg)] hover:bg-[var(--ck-neg-soft)]" : "text-[var(--ck-text)] hover:bg-[var(--ck-surface2)]"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
