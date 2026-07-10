import { useState } from "react";
import type { Row } from "@/lib/api";

export interface TableState {
  query: string;
  setQuery: (q: string) => void;
  perPage: number;
  setPerPage: (n: number) => void;
  view: Row[];      // filtered + paginated rows to render
  total: number;    // filtered count
  grand: number;    // unfiltered count
  loading: boolean; // rows not yet fetched
  reset: () => void;
  exportCsv: (name: string, cols: string[]) => void;
}

export function downloadCsv(name: string, cols: string[], rows: Row[]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const body = [cols.map(esc).join(",")]
    .concat(rows.map((r) => r.map(esc).join(",")))
    .join("\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Live client-side search + pagination + CSV export over a row array. */
export function useTable(rows?: Row[]): TableState {
  const [query, setQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const all = rows || [];
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((r) => r.join(" ").toLowerCase().includes(q)) : all;
  return {
    query, setQuery, perPage, setPerPage,
    view: filtered.slice(0, perPage),
    total: filtered.length,
    grand: all.length,
    loading: rows === undefined,
    reset: () => { setQuery(""); setPerPage(10); },
    exportCsv: (name, cols) => downloadCsv(name, cols, filtered),
  };
}
