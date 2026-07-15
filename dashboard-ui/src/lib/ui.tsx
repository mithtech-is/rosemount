import * as React from "react";
import {
  Grid, Briefcase, Users, Award, CreditCard, Calendar, Dollar, MessageSquare,
  Package, ShoppingCart, FileText, BookOpen, Mail, Speaker, BarChart2, Settings,
  Search, Bell, ChevronDown, RotateCcw, Download, Eye, Edit, Trash2, Book, UserCheck,
} from "@deemlol/next-icons";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TableState } from "@/lib/table";

export const C = {
  navy: "#1e3a8a", blue: "#2456c4", blueSoft: "#eaf0fb", yellow: "#f5b820",
  yellowSoft: "#fef4d9", ink: "#1f2a44", mute: "#5b667e", page: "#f4f6fb",
  green: "#1f9d54", greenSoft: "#e3f5ea", red: "#e05a5a", redSoft: "#fde7e7",
  // amber is the readable foreground form of `yellow` (yellow on white fails contrast);
  // use `yellow` only for fills (button bg, chart series), `amber` for text/numbers.
  amber: "#97700a",
};

export const NAV: [string, React.ComponentType<any>][] = [
  ["Dashboard", Grid], ["Branches", Briefcase], ["Staff", Users], ["HR", UserCheck], ["Students", Award],
  ["Academic", Book], ["Fees", CreditCard], ["Attendance", Calendar], ["Billing", Dollar],
  ["Enquiry", MessageSquare], ["Inventory", Package], ["Kit Ordering", ShoppingCart],
  ["Invoices", FileText], ["Curriculum", BookOpen], ["SMS / Email", Mail],
  ["Broadcast", Speaker], ["Reports", BarChart2], ["Settings", Settings],
];

/* ---------------- Sidebar ---------------- */
export function Sidebar({ active, onNav }: { active: string; onNav: (s: string) => void }) {
  return (
    <aside className="rm-sidebar w-[244px] shrink-0 flex flex-col py-5 text-white" style={{ background: C.navy }}>
      <div className="px-[22px] pb-5 flex items-center gap-3">
        <div className="rm-logo w-10 h-10 rounded-xl grid place-items-center font-black text-[19px]"
          style={{ background: C.yellow, color: C.navy }}>R</div>
        <div>
          <div className="font-extrabold text-[15px] leading-tight">Rosemount</div>
          <div className="text-[10.5px] tracking-wide" style={{ color: "#9fb4e8" }}>HQ ADMIN · ERP</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto pl-4 pr-0 py-1 space-y-1.5">
        {NAV.map(([label, Icon]) => {
          const on = active === label;
          // page-coloured concave corners where the tab meets the content on the right
          const notch = (pos: "top" | "bottom"): React.CSSProperties => ({
            position: "absolute", right: 0, [pos]: -22, width: 22, height: 22,
            background: "#fff",
            WebkitMaskImage: `radial-gradient(circle at ${pos} left, transparent 22px, #000 23px)`,
            maskImage: `radial-gradient(circle at ${pos} left, transparent 22px, #000 23px)`,
          });
          return (
            <button key={label} onClick={() => onNav(label)}
              className={`relative w-full flex items-center gap-3 px-4 py-3 text-[13.5px] text-left rounded-l-[24px] transition-colors ${on ? "rm-nav-active" : "rm-nav"}`}
              style={{
                background: on ? "#fff" : "transparent",
                color: on ? C.navy : "#c7d4f0",
                fontWeight: on ? 700 : 500,
              }}>
              {on && <><span aria-hidden style={notch("top")} /><span aria-hidden style={notch("bottom")} /></>}
              <Icon size={18} color={on ? C.navy : "#c7d4f0"} style={{ position: "relative", zIndex: 1 }} />
              <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-2 mx-3 pt-3 px-[18px]" style={{ borderTop: "1px solid #2f4aa0" }}>
        <div className="text-[11px]" style={{ color: "#9fb4e8" }}>AY 2026–2027</div>
        <a href="/api/method/logout">
          <button className="mt-2 w-full text-left text-[12.5px] font-semibold rounded-lg px-3 py-1.5"
            style={{ background: "#2a4aa8", color: "#fff" }}>Sign out</button>
        </a>
      </div>
    </aside>
  );
}

/* ---------------- Topbar ---------------- */
export function Topbar({ branch, branches, onBranch }:
  { branch: string; branches: string[]; onBranch: (b: string) => void }) {
  return (
    <header className="rm-topbar bg-white px-7 py-3.5 flex items-center justify-between border-b relative z-10" style={{ borderColor: "#eef1f7" }}>
      <div>
        <div className="text-[15px] font-extrabold" style={{ color: C.ink }}>HQ Console</div>
        <div className="text-[12.5px]" style={{ color: C.mute }}>All 24 branches · AY 2026–27</div>
      </div>
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 w-[240px]" style={{ background: C.page }}>
          <Search size={16} color={C.mute} />
          <input placeholder="Search students, staff, orders…"
            className="bg-transparent outline-none text-[13px] w-full" style={{ color: C.ink }} />
        </div>
        <Select value={branch || "__all"} onValueChange={(v) => onBranch(v === "__all" ? "" : v)}>
          <SelectTrigger className="border-0 font-semibold text-[13px] rounded-[10px] px-3.5 gap-2"
            style={{ background: C.blueSoft, color: C.blue }}>
            {branch || "All Branches"}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Branches</SelectItem>
            {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Bell size={20} color={C.mute} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full grid place-items-center text-[9px] font-extrabold"
            style={{ background: C.yellow, color: C.navy }}>3</span>
        </div>
        <Avatar className="w-9 h-9"><AvatarFallback style={{ background: C.navy, color: "#fff", fontSize: 14, fontWeight: 700 }}>HQ</AvatarFallback></Avatar>
      </div>
    </header>
  );
}

/* ---------------- primitives ---------------- */
export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-[18px]">
      <h1 className="m-0 text-[23px] font-extrabold" style={{ color: C.ink }}>{title}</h1>
      <div className="flex gap-2.5">{children}</div>
    </div>
  );
}

export function BrandBtn({ kind = "primary", icon: Icon, children, sm, ...p }:
  any & { kind?: "primary" | "yellow" | "ghost" | "danger"; icon?: React.ComponentType<any>; sm?: boolean }) {
  // colours are enforced in brand.css via button[data-brand=...] (shadcn's Button
  // applies its dark default bg above inline styles, so we override with CSS).
  const iconColor = kind === "yellow" ? C.navy : kind === "primary" ? "#fff" : kind === "danger" ? C.red : C.ink;
  return (
    <Button {...p} data-brand={kind} variant="ghost"
      className={`h-auto rounded-[9px] font-semibold gap-1.5 transition-transform active:scale-[.97] ${sm ? "py-2 px-3 text-[12.5px]" : "py-2.5 px-4 text-[13.5px]"}`}>
      {Icon && <Icon size={sm ? 14 : 16} color={iconColor} />}
      {children}
    </Button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="text-[11.5px] font-semibold mb-1.5" style={{ color: C.mute }}>{label}</div>
      {children}
    </div>
  );
}

export function FilterSelect({ placeholder, options }: { placeholder: string; options: string[] }) {
  return (
    <Select>
      <SelectTrigger className="w-full rounded-[9px]" style={{ borderColor: "#d9e0ee" }}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function FilterBar({ children, withExport = true, onReset, onExport }:
  { children: React.ReactNode; withExport?: boolean; onReset?: () => void; onExport?: () => void }) {
  return (
    <Card className="p-[18px] mb-[18px] rounded-2xl">
      <div className="flex gap-3.5 flex-wrap items-end">
        {children}
        <div className="flex gap-2.5 ml-auto">
          <BrandBtn kind="ghost" icon={RotateCcw} onClick={onReset}>Reset</BrandBtn>
          <BrandBtn icon={Search}>Search</BrandBtn>
          {withExport && <BrandBtn kind="yellow" icon={Download} onClick={onExport}>Export</BrandBtn>}
        </div>
      </div>
    </Card>
  );
}

export function StatusBadge({ text }: { text: string }) {
  // tone enforced in brand.css ([data-slot=badge][data-tone=...]) — shadcn Badge's
  // dark default bg wins over inline styles, same as Button.
  const tone: Record<string, string> = {
    Active: "ok", Success: "ok", Verified: "ok", Paid: "ok", Completed: "ok",
    Inactive: "no", Unverified: "no", Unpaid: "no", Dropped: "no", Rejected: "no",
    Pending: "pend", Product: "blue", Accepted: "blue", Dispatched: "blue",
  };
  return <Badge data-tone={tone[text] || "blue"} className="rounded-full font-bold text-[11px] px-2.5 py-[3px] border-0">{text}</Badge>;
}

/* Full-featured, live table: search + rows-per-page + skeleton + empty + footer count. */
export function DataTable({ cols, t, render, exportName }:
  { cols: string[]; t: TableState; render: (r: any, i: number) => React.ReactNode; exportName?: string }) {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-[18px] py-4 gap-3">
        <Select value={String(t.perPage)} onValueChange={(v) => t.setPerPage(Number(v))}>
          <SelectTrigger className="w-[80px] rounded-[9px]" style={{ borderColor: "#d9e0ee" }}><SelectValue /></SelectTrigger>
          <SelectContent>{["10", "25", "50", "100"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2.5">
          <div className="relative w-[240px]">
            <Search size={15} color={C.mute} style={{ position: "absolute", left: 11, top: 11 }} />
            <Input value={t.query} onChange={(e) => t.setQuery(e.target.value)} placeholder="Search…"
              className="rounded-[9px] pl-8" style={{ borderColor: "#d9e0ee" }} />
          </div>
          {exportName && <BrandBtn kind="yellow" icon={Download} sm onClick={() => t.exportCsv(exportName, cols)}>Export</BrandBtn>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            {cols.map((c) => <TableHead key={c} className="uppercase text-[11px] tracking-wide" style={{ color: C.mute }}>{c}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {t.loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{cols.map((c) => <TableCell key={c}><div className="rm-skel h-3.5 w-[70%]" /></TableCell>)}</TableRow>
                ))
              : t.view.length === 0
                ? <TableRow><TableCell colSpan={cols.length} className="py-12 text-center" style={{ color: C.mute }}>
                    {t.grand === 0 ? "No records yet." : "No matches for your search."}
                  </TableCell></TableRow>
                : t.view.map((r, i) => <TableRow key={i} className="transition-colors hover:bg-[#f8fafd]">{render(r, i)}</TableRow>)}
          </TableBody>
        </Table>
      </div>
      {!t.loading && t.grand > 0 && (
        <div className="px-[18px] py-3 text-[12px]" style={{ color: C.mute }}>
          Showing {t.view.length} of {t.total}{t.total !== t.grand ? ` (filtered from ${t.grand})` : ""}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Drawer (slide-over detail panel) ----------------
   Used by the Students / Staff profile views. Closes on backdrop click and Esc,
   traps nothing (read-only content), and never blocks the page when closed. */
export function Drawer({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rm-drawer-root fixed inset-0 z-[1000]">
      <div className="rm-drawer-scrim absolute inset-0" onClick={onClose} aria-hidden />
      <aside
        role="dialog" aria-modal="true" aria-label={title}
        className="rm-drawer absolute top-0 right-0 h-full w-[520px] max-w-[92vw] bg-white flex flex-col"
      >
        <header className="px-6 py-5 flex items-start gap-3 border-b" style={{ borderColor: "#eef1f7" }}>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[19px] font-extrabold truncate" style={{ color: C.ink }}>{title}</h2>
            {subtitle && <div className="text-[12.5px] mt-0.5 truncate" style={{ color: C.mute }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rm-drawer-x w-9 h-9 rounded-full grid place-items-center shrink-0"
            style={{ color: C.mute }}>✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="px-6 py-4 border-t" style={{ borderColor: "#eef1f7" }}>{footer}</footer>}
      </aside>
    </div>
  );
}

/* Label/value pair used inside the Drawer */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2">
      <div className="text-[12px] w-[124px] shrink-0" style={{ color: C.mute }}>{label}</div>
      <div className="text-[13.5px] font-semibold min-w-0 break-words">{value ?? "—"}</div>
    </div>
  );
}

/* Section heading inside the Drawer */
export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="rm-eyebrow text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: C.mute }}>{title}</div>
      {children}
    </section>
  );
}

export function Placeholder({ name, note }: { name: string; note: string }) {
  return (
    <Card className="rounded-2xl py-14 px-6 text-center">
      <div className="w-[60px] h-[60px] rounded-2xl grid place-items-center mx-auto mb-4" style={{ background: C.blueSoft }}>
        <Settings size={28} color={C.blue} />
      </div>
      <h3 className="m-0 mb-1.5 text-[17px] font-bold">{name}</h3>
      <p className="m-0 text-[13.5px] max-w-[440px] mx-auto" style={{ color: C.mute }}>{note}</p>
    </Card>
  );
}

export const RowIcons = { Eye, Edit, Trash2, Download, ChevronDown };
