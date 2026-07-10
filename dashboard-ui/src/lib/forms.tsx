import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Edit, Trash2 } from "@deemlol/next-icons";
import { BrandBtn, C } from "@/lib/ui";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "date";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

function FormDialog({ open, onOpenChange, title, fields, vals, setVals, onSave, busy }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; fields: FieldDef[];
  vals: Record<string, any>; setVals: (v: Record<string, any>) => void; onSave: () => void; busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-1">
          {fields.map((f) => (
            <div key={f.name} className="grid gap-1.5">
              <Label className="text-[12.5px] font-semibold" style={{ color: C.mute }}>
                {f.label}{f.required ? " *" : ""}
              </Label>
              {f.type === "select" ? (
                <Select value={vals[f.name] || ""} onValueChange={(v) => setVals({ ...vals, [f.name]: v })}>
                  <SelectTrigger className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }}>
                    <SelectValue placeholder={f.placeholder || "Select"} />
                  </SelectTrigger>
                  <SelectContent>{(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} placeholder={f.placeholder}
                  value={vals[f.name] ?? ""} onChange={(e) => setVals({ ...vals, [f.name]: e.target.value })}
                  className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <BrandBtn kind="ghost" onClick={() => onOpenChange(false)}>Cancel</BrandBtn>
          <BrandBtn onClick={onSave} disabled={busy}>{busy ? "Saving…" : "Save"}</BrandBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Add" button that opens a create form and calls `submit(values)`. */
export function AddButton({ label, icon, kind = "yellow", title, fields, submit, onDone }: {
  label: string; icon?: React.ComponentType<any>; kind?: "primary" | "yellow" | "ghost";
  title: string; fields: FieldDef[]; submit: (v: any) => Promise<any>; onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    for (const f of fields) if (f.required && !vals[f.name]) return toast.error(`${f.label} is required`);
    setBusy(true);
    try {
      await submit(vals);
      toast.success(`${title} saved`);
      setOpen(false); setVals({}); onDone?.();
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <BrandBtn kind={kind} icon={icon} onClick={() => { setVals({}); setOpen(true); }}>{label}</BrandBtn>
      <FormDialog open={open} onOpenChange={setOpen} title={title} fields={fields} vals={vals} setVals={setVals} onSave={save} busy={busy} />
    </>
  );
}

/** Pencil icon that opens an edit form for allowlisted fields and calls update_doc. */
export function EditAction({ doctype, name, fields, initial, onDone, update }: {
  doctype: string; name: string; fields: FieldDef[]; initial: Record<string, any>;
  onDone?: () => void; update: (doctype: string, name: string, values: any) => Promise<any>;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, any>>(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await update(doctype, name, vals);
      toast.success("Updated");
      setOpen(false); onDone?.();
    } catch (e: any) { toast.error(e?.message || "Could not update"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button title="Edit" onClick={() => { setVals(initial); setOpen(true); }}><Edit size={16} color={C.blue} /></button>
      <FormDialog open={open} onOpenChange={setOpen} title={`Edit ${name}`} fields={fields} vals={vals} setVals={setVals} onSave={save} busy={busy} />
    </>
  );
}

/** Trash icon that confirms then deletes via remove_doc. */
export function DeleteAction({ doctype, name, onDone, remove }: {
  doctype: string; name: string; onDone?: () => void; remove: (doctype: string, name: string) => Promise<any>;
}) {
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    try { await remove(doctype, name); toast.success("Deleted"); onDone?.(); }
    catch (e: any) { toast.error(e?.message || "Could not delete"); }
    finally { setBusy(false); }
  };
  return <button title="Delete" onClick={del} disabled={busy}><Trash2 size={16} color={C.red} /></button>;
}

/** Eye icon that shows a read-only detail dialog built from the row + columns. */
export function ViewAction({ cols, row }: { cols: string[]; row: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button title="View" onClick={() => setOpen(true)}><Eye size={16} color={C.mute} /></button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Details</DialogTitle></DialogHeader>
          <div className="grid gap-2.5 py-1">
            {cols.filter((c) => c).map((c, i) => (
              <div key={c} className="flex justify-between gap-4 border-b pb-2 text-[13px]" style={{ borderColor: "#f1f4fa" }}>
                <span style={{ color: C.mute }}>{c}</span>
                <span className="font-semibold text-right">{String(row[i] ?? "—")}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Collect" button → modal to record a payment against an invoice. */
export function PaymentAction({ invoice, outstanding, submit, onDone }: {
  invoice: string; outstanding: string | number; submit: (v: any) => Promise<any>; onDone?: () => void;
}) {
  const clean = String(outstanding).replace(/,/g, "");
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(clean);
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try { await submit({ invoice, amount: Number(amt) }); toast.success("Payment recorded"); setOpen(false); onDone?.(); }
    catch (e: any) { toast.error(e?.message || "Could not record payment"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <BrandBtn sm kind="primary" onClick={() => { setAmt(clean); setOpen(true); }}>Collect</BrandBtn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Record payment · {invoice}</DialogTitle></DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label className="text-[12.5px] font-semibold" style={{ color: C.mute }}>Amount (₹) · outstanding {clean}</Label>
            <Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} />
          </div>
          <DialogFooter>
            <BrandBtn kind="ghost" onClick={() => setOpen(false)}>Cancel</BrandBtn>
            <BrandBtn onClick={pay} disabled={busy}>{busy ? "Saving…" : "Record"}</BrandBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { toast };
