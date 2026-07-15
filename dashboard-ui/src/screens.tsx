import * as React from "react";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  Briefcase, Award, Users, Clipboard, UserPlus, Calendar, CreditCard, Percent,
  MessageSquare, ShoppingCart, Package, Truck, Send, FileText, Plus, Eye, Download,
  ChevronRight, CheckCircle, XCircle, Bell, Mail,
} from "@deemlol/next-icons";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  C, PageHead, BrandBtn, Field, FilterSelect, FilterBar, StatusBadge, Placeholder, DataTable,
  Drawer, DetailRow, DetailSection,
} from "@/lib/ui";
import { api, compact, inr, stripRmips } from "@/lib/api";
import { useTable, downloadCsv } from "@/lib/table";
import { AddButton, EditAction, DeleteAction, ViewAction, PaymentAction, toast } from "@/lib/forms";
import type { FieldDef } from "@/lib/forms";
import { NOTICES, QUICK, CLASSES, SMS_MATRIX } from "@/lib/static";
import type { Row, Summary, FeeOverview, Funnel, Attendance, StudentAttendanceToday, StudentProfile } from "@/lib/api";

export interface Ctx {
  branch: string;
  reload: () => void;
  d: {
    summary?: Summary; feeOverview?: FeeOverview;
    feeByBranch?: { branch: string; value: number }[];
    feeTrend?: { m: string; collected: number; pending: number }[];
    funnel?: Funnel; kitOrders?: Row[]; attendance?: Attendance;
    branches?: Row[]; staff?: Row[]; students?: Row[]; feeRows?: Row[];
    inventory?: Row[]; invoices?: Row[]; billing?: Row[]; curriculum?: Row[];
    reports?: Row[]; settings?: any;
    academicYears?: Row[]; programs?: Row[]; holidayLists?: Row[];
    feeStructures?: Row[]; receipts?: Row[]; outstanding?: Row[];
    enquiry?: Row[]; kitOrderList?: Row[];
    hrEmployees?: Row[]; leaveApps?: Row[]; salarySlips?: Row[]; departments?: Row[];
    courses?: Row[]; topics?: Row[]; hqUsers?: Row[];
    // Phase 1
    events?: Row[];
    stuAttendance?: StudentAttendanceToday;
    attTrend?: { d: string; rate: number; present: number; absent: number }[];
    attRows?: { date: string | null; rows: Row[] };
  };
}

/* per-row kit workflow actions (Accept/Reject/Dispatch by stage) */
function KitStatusActions({ so, status, reload }: { so: string; status: string; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const move = async (to: string) => {
    setBusy(true);
    try { await api.setKitStatus({ order: so, status: to }); toast.success("Order " + to.toLowerCase()); reload(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };
  if (status === "Pending")
    return <div className="flex gap-2"><BrandBtn sm kind="primary" onClick={() => move("Accepted")} disabled={busy}>Accept</BrandBtn><BrandBtn sm kind="danger" onClick={() => move("Rejected")} disabled={busy}>Reject</BrandBtn></div>;
  if (status === "Accepted" || status === "Dispatched")
    return <BrandBtn sm kind="yellow" onClick={() => move("Completed")} disabled={busy}>Dispatch</BrandBtn>;
  return <span className="text-[12px] font-semibold" style={{ color: status === "Completed" ? "#1f9d54" : "#e05a5a" }}>{status}</span>;
}

const QUICK_ICONS: Record<string, React.ComponentType<any>> = {
  UserPlus, Users, Calendar, CreditCard, Percent, MessageSquare, ShoppingCart, Package, Truck, Send, FileText, Plus,
};

/* ---------------- shared ---------------- */
function UTabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Tabs value={value} onValueChange={onChange} className="mb-5">
      <TabsList className="bg-transparent rounded-none w-full justify-start h-auto p-0 gap-1 border-b" style={{ borderColor: "#e7ecf5" }}>
        {tabs.map((t) => (
          <TabsTrigger key={t} value={t}
            className="rounded-none border-b-2 border-transparent bg-transparent shadow-none px-4 py-2.5 text-[13.5px] font-medium data-[state=active]:shadow-none data-[state=active]:font-bold"
            style={{ color: value === t ? C.blue : C.mute, borderBottomColor: value === t ? C.blue : "transparent" }}>
            {t}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

const branchOpts = (d: Ctx["d"]) => (d.branches || []).map((b) => String(b[1]));
const StateCityBranch = (d: Ctx["d"]) => (
  <>
    <Field label="State"><FilterSelect placeholder="Select State" options={["Karnataka"]} /></Field>
    <Field label="City"><FilterSelect placeholder="Select City" options={["Bengaluru"]} /></Field>
    <Field label="Branch"><FilterSelect placeholder="Select Branch" options={branchOpts(d)} /></Field>
  </>
);

/* ===================== DASHBOARD ===================== */
function Dashboard({ d }: Ctx) {
  const s = d.summary, f = d.feeOverview;
  const cards: [string, any, string, React.ComponentType<any>, boolean][] = [
    ["Total Branches", s?.branches ?? "—", `${s?.branchesActive ?? 0} active`, Briefcase, false],
    ["Total Students", s?.students ?? "—", "enrolled this year", Award, true],
    ["Total Staff", s?.staff ?? "—", "teaching + support", Users, false],
    ["Pending Admissions", s?.pendingAdmissions ?? "—", "follow-up enquiries", Clipboard, true],
  ];
  const pct = f && f.total ? Math.round((f.collected / f.total) * 100) : 0;
  const funnel = d.funnel;
  const att = d.stuAttendance;
  const enquiry = [
    { name: "Converted", value: funnel?.converted ?? 0, color: C.blue },
    { name: "Dropped", value: funnel?.dropped ?? 0, color: C.red },
    { name: "Follow-Up", value: funnel?.followup ?? 0, color: C.yellow },
  ];
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        {cards.map(([label, val, sub, Icon, y]) => (
          <Card key={label} className="rm-stat px-5 py-[18px] flex flex-row items-center gap-4 rounded-2xl">
            <div className="w-[52px] h-[52px] rounded-[13px] grid place-items-center" style={{ background: y ? C.yellowSoft : C.blueSoft }}>
              <Icon size={26} color={y ? C.yellow : C.blue} /></div>
            <div>
              <div className="text-[26px] font-extrabold leading-none">{typeof val === "number" ? val.toLocaleString("en-IN") : val}</div>
              <div className="text-[13.5px] font-semibold mt-1">{label}</div>
              <div className="text-[11.5px]" style={{ color: C.mute }}>{sub}</div>
            </div>
          </Card>
        ))}
      </div>
      <div className="rm-eyebrow text-[13px] font-bold uppercase tracking-wider mb-3" style={{ color: C.mute }}>Quick Actions</div>
      <div className="grid grid-cols-12 gap-3 mb-5">
        {QUICK.map(([label, icon, y]) => {
          const Icon = QUICK_ICONS[icon] || Plus;
          return (
            <button key={label} onClick={() => toast(`${label}: open the matching module from the sidebar.`)}
              className="rm-quick bg-white border rounded-2xl py-4 px-2 flex flex-col items-center gap-2.5 transition-transform active:scale-[.97] hover:-translate-y-0.5" style={{ borderColor: "#eef1f7" }}>
              <div className="w-[42px] h-[42px] rounded-xl grid place-items-center" style={{ background: y ? C.yellowSoft : C.blueSoft }}><Icon size={21} color={y ? C.yellow : C.blue} /></div>
              <span className="text-[11.5px] font-semibold text-center leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <Card className="p-5 rounded-2xl">
          <h3 className="m-0 mb-3.5 text-[15.5px] font-bold">Fee Collection — All Branches</h3>
          <div className="flex gap-6 mb-3.5 flex-wrap items-end">
            <div><div className="text-[18px] font-extrabold">{compact(f?.total ?? 0)}</div><div className="text-[11.5px]" style={{ color: C.mute }}>Total Fee</div></div>
            <div><div className="text-[18px] font-extrabold" style={{ color: C.blue }}>{compact(f?.collected ?? 0)}</div><div className="text-[11.5px]" style={{ color: C.mute }}>Collected</div></div>
            <div><div className="text-[18px] font-extrabold" style={{ color: C.red }}>{compact(f?.pending ?? 0)}</div><div className="text-[11.5px]" style={{ color: C.mute }}>Pending</div></div>
            <div className="ml-auto text-right"><div className="text-[26px] font-extrabold" style={{ color: C.amber }}>{pct}%</div><div className="text-[11.5px]" style={{ color: C.mute }}>collected</div></div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={d.feeTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="collected" stroke={C.blue} strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="pending" stroke={C.red} strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5 rounded-2xl">
          <h3 className="m-0 mb-2 text-[15.5px] font-bold">Fee by Branch (₹ Lakh)</h3>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={(d.feeByBranch || []).map((r) => ({ b: stripRmips(r.branch), v: r.value }))} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" hide /><YAxis type="category" dataKey="b" tick={{ fontSize: 11.5, fill: C.ink }} axisLine={false} tickLine={false} width={78} />
              <Tooltip /><Bar dataKey="v" radius={[0, 6, 6, 0]} fill={C.blue} barSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.4fr 1fr" }}>
        <Card className="p-5 rounded-2xl">
          <h3 className="m-0 mb-2 text-[15.5px] font-bold">Admissions Funnel</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart><Pie data={enquiry} dataKey="value" innerRadius={46} outerRadius={68} paddingAngle={2} isAnimationActive={false}>
                {enquiry.map((e) => <Cell key={e.name} fill={e.color} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none -mt-1.5 text-center">
              <div><div className="text-[22px] font-extrabold">{funnel?.total ?? 0}</div><div className="text-[10.5px]" style={{ color: C.mute }}>total enquiries</div></div>
            </div>
          </div>
          {enquiry.map((e) => (
            <div key={e.name} className="flex items-center gap-2 text-[12.5px] mt-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: e.color }} /><span style={{ color: C.mute }}>{e.name}</span><span className="ml-auto font-bold">{e.value}</span>
            </div>
          ))}
        </Card>
        <Card className="rounded-2xl overflow-hidden">
          <div className="px-5 py-4 text-[15.5px] font-bold">Pending Kit Orders</div>
          <Table>
            <TableHeader><TableRow>{["Order", "Branch", "Kit", "Amount", "Status"].map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {(d.kitOrders || []).map((o) => (
                <TableRow key={String(o[0])} className="transition-colors hover:bg-[#f8fafd]">
                  <TableCell className="font-bold">#{o[0]}</TableCell><TableCell>{stripRmips(String(o[2]))}</TableCell>
                  <TableCell style={{ color: C.mute }}>{o[1]}</TableCell><TableCell>₹{o[5]}</TableCell>
                  <TableCell><StatusBadge text={String(o[4])} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-5 rounded-2xl">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="m-0 text-[15.5px] font-bold">Upcoming</h3>
            <span className="text-[11px]" style={{ color: C.mute }}>annual calendar</span>
          </div>
          {(d.events || []).length === 0 && (
            <div className="text-[12.5px] py-6 text-center" style={{ color: C.mute }}>
              No upcoming events on the calendar.
            </div>
          )}
          {(d.events || []).slice(0, 5).map((e, i) => {
            const kind = String(e[0]);
            const col = kind === "EVENT" ? C.blue : C.amber;
            return (
              <div key={i} className="rm-notice flex gap-3 p-3 rounded-xl mb-2.5" style={{ background: "#f8fafd" }}>
                <span className="w-1 rounded" style={{ background: col }} />
                <div className="min-w-0">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: col }}>{kind}</div>
                  <div className="text-[13.5px] font-semibold mt-px truncate">{String(e[1])}</div>
                  <div className="text-[11.5px] mt-px" style={{ color: C.mute }}>{String(e[2])}</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* ---- Student attendance (Phase 1) ---- */}
      <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "1fr 2fr" }}>
        <Card className="p-5 rounded-2xl">
          <h3 className="m-0 mb-1 text-[15.5px] font-bold">Student Attendance</h3>
          <div className="text-[11.5px] mb-4" style={{ color: C.mute }}>
            {att?.date ? `latest register · ${att.date}` : "no register marked yet"}
          </div>
          <div className="flex items-end gap-2">
            <div className="text-[34px] font-extrabold leading-none rm-num" style={{ color: C.blue }}>
              {att?.rate ?? 0}<span className="text-[18px]">%</span>
            </div>
            <div className="text-[11.5px] pb-1.5" style={{ color: C.mute }}>present</div>
          </div>
          <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "#eef1f7" }}>
            <div className="h-full rounded-full" style={{ width: `${att?.rate ?? 0}%`, background: C.blue }} />
          </div>
          <div className="flex gap-5 mt-4">
            <div><div className="text-[17px] font-extrabold rm-num" style={{ color: C.green }}>{att?.present ?? 0}</div>
              <div className="text-[11px]" style={{ color: C.mute }}>Present</div></div>
            <div><div className="text-[17px] font-extrabold rm-num" style={{ color: C.red }}>{att?.absent ?? 0}</div>
              <div className="text-[11px]" style={{ color: C.mute }}>Absent</div></div>
            <div className="ml-auto text-right"><div className="text-[17px] font-extrabold rm-num">{att?.total ?? 0}</div>
              <div className="text-[11px]" style={{ color: C.mute }}>Students</div></div>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl">
          <h3 className="m-0 mb-3.5 text-[15.5px] font-bold">Attendance Trend — last 10 school days</h3>
          <ResponsiveContainer width="100%" height={168}>
            <LineChart data={d.attTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip formatter={(v: any) => [`${v}%`, "Present"]} />
              <Line type="monotone" dataKey="rate" stroke={C.blue} strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ===================== BRANCHES ===================== */
function Branches({ d, reload }: Ctx) {
  const [tab, setTab] = useState("Manage Schools");
  const cols = ["Branch ID", "Name", "Email", "Phone", "Status", "Option"];
  const t = useTable(d.branches);
  const addFields: FieldDef[] = [
    { name: "name", label: "Branch Name", required: true, placeholder: "RMIPS …" },
    { name: "code", label: "Branch Code", placeholder: "RMKA00XX" },
    { name: "email", label: "Email" }, { name: "phone", label: "Phone" },
    { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  ];
  const editFields: FieldDef[] = [
    { name: "custom_email", label: "Email" }, { name: "custom_phone", label: "Phone" },
    { name: "custom_status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  ];
  return (
    <div>
      <PageHead title="Our Branches">
        <AddButton label="Add School" icon={Plus} title="Add School" fields={addFields} submit={api.addBranch} onDone={reload} />
      </PageHead>
      <UTabs tabs={["Manage Schools", "Tier Group", "Branch Group", "Settings"]} value={tab} onChange={setTab} />
      {tab === "Manage Schools" ? (
        <>
          <FilterBar onReset={t.reset} onExport={() => t.exportCsv("branches", cols)}>
            <Field label="State"><FilterSelect placeholder="Select State" options={["Karnataka"]} /></Field>
            <Field label="City"><FilterSelect placeholder="Select City" options={["Bengaluru"]} /></Field>
            <Field label="Status"><FilterSelect placeholder="All" options={["Active", "Inactive"]} /></Field>
          </FilterBar>
          <DataTable cols={cols} t={t} render={(r) => (<>
            <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
            <TableCell>{r[3]}</TableCell><TableCell><StatusBadge text={r[4]} /></TableCell>
            <TableCell><div className="flex gap-3 items-center">
              <ViewAction cols={cols} row={r} />
              <EditAction doctype="Branch" name={String(r[1])} fields={editFields}
                initial={{ custom_email: r[2], custom_phone: r[3], custom_status: r[4] }} update={api.updateDoc} onDone={reload} />
              <DeleteAction doctype="Branch" name={String(r[1])} remove={api.removeDoc} onDone={reload} />
            </div></TableCell>
          </>)} />
        </>
      ) : <Placeholder name={tab} note="Tier / branch grouping & branch-level settings configured here." />}
    </div>
  );
}

/* ===================== STAFF ===================== */
/* Staff profile drawer (Phase 1) */
function StaffProfileDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [e, setE] = useState<Record<string, any> | null>(null);
  const [err, setErr] = useState("");
  React.useEffect(() => {
    if (!id) { setE(null); setErr(""); return; }
    let alive = true;
    setE(null); setErr("");
    api.staffProfile(id)
      .then((r) => alive && setE(r))
      .catch((x) => alive && setErr(x?.message || "Could not load profile"));
    return () => { alive = false; };
  }, [id]);
  return (
    <Drawer open={!!id} onClose={onClose}
      title={e?.employee_name || "Staff member"}
      subtitle={e ? `${e.designation || "—"} · ${stripRmips(e.branch || "")}` : id || ""}>
      {err && <div className="p-3 rounded-lg text-[13px]" style={{ background: C.redSoft, color: C.red }}>{err}</div>}
      {!e && !err && <div className="space-y-3">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="rm-skel h-4 w-full" />)}</div>}
      {e && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rm-stat-mini p-3.5 rounded-xl" style={{ background: C.blueSoft }}>
              <div className="text-[19px] font-extrabold rm-num" style={{ color: C.blue }}>{e.attendanceRate ?? "—"}{e.attendanceRate != null && <span className="text-[12px]">%</span>}</div>
              <div className="text-[11px] font-semibold" style={{ color: C.blue }}>Attendance</div>
            </div>
            <div className="rm-stat-mini p-3.5 rounded-xl" style={{ background: C.yellowSoft }}>
              <div className="text-[19px] font-extrabold rm-num" style={{ color: C.amber }}>{e.leaves ?? 0}</div>
              <div className="text-[11px] font-semibold" style={{ color: C.amber }}>Leave requests</div>
            </div>
          </div>
          <DetailSection title="Employee">
            <DetailRow label="Employee ID" value={e.name} />
            <DetailRow label="Code / Username" value={e.employee_number || "—"} />
            <DetailRow label="Designation" value={e.designation || "—"} />
            <DetailRow label="Department" value={e.department || "—"} />
            <DetailRow label="Branch" value={e.branch || "—"} />
            <DetailRow label="Joined" value={e.date_of_joining || "—"} />
            <DetailRow label="Status" value={<StatusBadge text={e.status || "Active"} />} />
          </DetailSection>
          <DetailSection title="Contact">
            <DetailRow label="Mobile" value={e.cell_number || "—"} />
            <DetailRow label="Company email" value={e.company_email || "—"} />
            <DetailRow label="Personal email" value={e.personal_email || "—"} />
          </DetailSection>
        </>
      )}
    </Drawer>
  );
}

function Staff({ d, reload }: Ctx) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const cols = ["Name", "School", "Designation", "Username", "Phone", "Status", "Verification", ""];
  const t = useTable(d.staff);
  const addFields: FieldDef[] = [
    { name: "name", label: "Full Name", required: true },
    { name: "branch", label: "Branch", type: "select", options: branchOpts(d) },
    { name: "designation", label: "Designation", type: "select", options: ["Teacher", "Non Teaching", "Cleaning Staff"] },
    { name: "phone", label: "Phone" }, { name: "username", label: "Username / Code" },
  ];
  return (
    <div>
      <PageHead title="Staff">
        <AddButton label="Add Staff" icon={UserPlus} title="Add Staff" fields={addFields} submit={api.addStaff} onDone={reload} />
      </PageHead>
      <FilterBar onReset={t.reset} onExport={() => t.exportCsv("staff", cols)}>
        {StateCityBranch(d)}
        <Field label="Verification"><FilterSelect placeholder="All" options={["Verified", "Unverified"]} /></Field>
      </FilterBar>
      <DataTable cols={cols} t={t} render={(r) => (<>
        <TableCell>
          <button className="rm-link font-bold text-left" onClick={() => setProfileId(String(r[6]))}>{r[0]}</button>
        </TableCell>
        <TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
        <TableCell>{r[3]}</TableCell><TableCell>{r[4]}</TableCell><TableCell><StatusBadge text={r[5]} /></TableCell>
        <TableCell><StatusBadge text="Verified" /></TableCell>
        <TableCell>
          <button className="rm-icon-btn" title="Open profile" aria-label={`Open profile for ${r[0]}`}
            onClick={() => setProfileId(String(r[6]))}><Eye size={16} color={C.mute} /></button>
        </TableCell>
      </>)} />
      <StaffProfileDrawer id={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}

/* ===================== STUDENTS ===================== */
/* Student profile — identity, guardians, enrolment, fees, attendance (Phase 1) */
function StudentProfileDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [p, setP] = useState<StudentProfile | null>(null);
  const [ledger, setLedger] = useState<{ invoices: Row[]; payments: Row[] } | null>(null);
  const [err, setErr] = useState("");

  React.useEffect(() => {
    if (!id) { setP(null); setLedger(null); setErr(""); return; }
    let alive = true;
    setP(null); setLedger(null); setErr("");
    Promise.all([api.studentProfile(id), api.feeLedger(id)])
      .then(([prof, led]) => { if (alive) { setP(prof); setLedger(led); } })
      .catch((e) => alive && setErr(e?.message || "Could not load profile"));
    return () => { alive = false; };
  }, [id]);

  const s = p?.student;
  return (
    <Drawer open={!!id} onClose={onClose}
      title={s?.student_name || "Student"}
      subtitle={s ? `${id} · ${stripRmips(s.branch || "")}` : id || ""}>
      {err && <div className="p-3 rounded-lg text-[13px]" style={{ background: C.redSoft, color: C.red }}>{err}</div>}
      {!p && !err && <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="rm-skel h-4 w-full" />)}</div>}
      {p && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rm-stat-mini p-3.5 rounded-xl" style={{ background: C.blueSoft }}>
              <div className="text-[19px] font-extrabold rm-num" style={{ color: C.blue }}>{p.attendance.rate ?? "—"}{p.attendance.rate != null && <span className="text-[12px]">%</span>}</div>
              <div className="text-[11px] font-semibold" style={{ color: C.blue }}>Attendance</div>
            </div>
            <div className="rm-stat-mini p-3.5 rounded-xl" style={{ background: C.greenSoft }}>
              <div className="text-[19px] font-extrabold rm-num" style={{ color: C.green }}>{compact(p.fees.collected)}</div>
              <div className="text-[11px] font-semibold" style={{ color: C.green }}>Paid</div>
            </div>
            <div className="rm-stat-mini p-3.5 rounded-xl" style={{ background: C.redSoft }}>
              <div className="text-[19px] font-extrabold rm-num" style={{ color: C.red }}>{compact(p.fees.pending)}</div>
              <div className="text-[11px] font-semibold" style={{ color: C.red }}>Pending</div>
            </div>
          </div>

          <DetailSection title="Student">
            <DetailRow label="Admission No" value={s.name} />
            <DetailRow label="Class" value={p.enrollment?.program || "—"} />
            <DetailRow label="Academic Year" value={p.enrollment?.academic_year || "—"} />
            <DetailRow label="Branch" value={s.branch || "—"} />
            <DetailRow label="Mobile" value={s.student_mobile_number || "—"} />
            <DetailRow label="Email" value={s.student_email_id || "—"} />
            <DetailRow label="Joined" value={s.joining_date || "—"} />
            <DetailRow label="Status" value={<StatusBadge text={s.enabled ? "Active" : "Inactive"} />} />
          </DetailSection>

          <DetailSection title={`Guardians (${p.guardians.length})`}>
            {p.guardians.length === 0 && <div className="text-[12.5px]" style={{ color: C.mute }}>No guardians recorded.</div>}
            {p.guardians.map((g) => (
              <div key={g.guardian} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "#f2f5fa" }}>
                <div className="w-9 h-9 rounded-full grid place-items-center text-[12px] font-bold shrink-0"
                  style={{ background: C.blueSoft, color: C.blue }}>{g.relation?.[0] || "G"}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold truncate">{g.guardian_name}</div>
                  <div className="text-[11.5px] truncate" style={{ color: C.mute }}>{g.relation} · {g.mobile || "no phone"}</div>
                </div>
              </div>
            ))}
          </DetailSection>

          <DetailSection title={`Fee ledger (${ledger?.invoices.length ?? 0} invoices)`}>
            {(ledger?.invoices || []).length === 0 && <div className="text-[12.5px]" style={{ color: C.mute }}>No invoices raised.</div>}
            {(ledger?.invoices || []).map((r) => (
              <div key={String(r[0])} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "#f2f5fa" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold truncate">{String(r[0])}</div>
                  <div className="text-[11.5px]" style={{ color: C.mute }}>{String(r[1])}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-extrabold rm-num">{inr(Number(r[2]))}</div>
                  <div className="text-[11px] rm-num" style={{ color: Number(r[4]) > 0 ? C.red : C.green }}>
                    {Number(r[4]) > 0 ? `${inr(Number(r[4]))} due` : "settled"}
                  </div>
                </div>
                <StatusBadge text={String(r[5])} />
              </div>
            ))}
          </DetailSection>

          {(ledger?.payments || []).length > 0 && (
            <DetailSection title="Payments received">
              {(ledger?.payments || []).map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "#f2f5fa" }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold truncate">{String(r[0])}</div>
                    <div className="text-[11.5px]" style={{ color: C.mute }}>{String(r[1])} · {String(r[2])}</div>
                  </div>
                  <div className="text-[13px] font-extrabold rm-num" style={{ color: C.green }}>{inr(Number(r[4]))}</div>
                </div>
              ))}
            </DetailSection>
          )}
        </>
      )}
    </Drawer>
  );
}

function Students({ d, reload }: Ctx) {
  const [tab, setTab] = useState("Student");
  const [profileId, setProfileId] = useState<string | null>(null);
  const cols = ["Adm No", "Name", "School", "Class", "Phone", "Verification", ""];
  const t = useTable(d.students);
  const addFields: FieldDef[] = [
    { name: "name", label: "Student Name", required: true },
    { name: "branch", label: "Branch", type: "select", options: branchOpts(d) },
    { name: "program", label: "Class", type: "select", options: CLASSES },
    { name: "mobile", label: "Mobile" },
  ];
  return (
    <div>
      <PageHead title="Students">
        <BrandBtn kind="ghost" icon={FileText} onClick={() => toast("ID-card printing needs a print template — not provisioned in this build.")}>Print ID Card</BrandBtn>
        <AddButton label="Add Student" icon={UserPlus} title="Add Student" fields={addFields} submit={api.addStudent} onDone={reload} />
      </PageHead>
      <UTabs tabs={["Student", "Ex-Student", "Student History", "Settings", "Form Setting"]} value={tab} onChange={setTab} />
      {tab === "Student" ? (
        <>
          <FilterBar onReset={t.reset} onExport={() => t.exportCsv("students", cols)}>
            {StateCityBranch(d)}
            <Field label="Class"><FilterSelect placeholder="All Classes" options={CLASSES} /></Field>
          </FilterBar>
          <DataTable cols={cols} t={t} render={(r) => (<>
            <TableCell style={{ color: C.mute }}>{r[0]}</TableCell>
            <TableCell>
              <button className="rm-link font-bold text-left" onClick={() => setProfileId(String(r[0]))}>{r[1]}</button>
            </TableCell>
            <TableCell>{r[2]}</TableCell><TableCell>{r[3]}</TableCell><TableCell>{r[4]}</TableCell>
            <TableCell><StatusBadge text={r[5] === "Active" ? "Verified" : "Unverified"} /></TableCell>
            <TableCell><div className="flex gap-3 items-center">
              <button className="rm-icon-btn" title="Open profile" aria-label={`Open profile for ${r[1]}`}
                onClick={() => setProfileId(String(r[0]))}><Eye size={16} color={C.mute} /></button>
              <DeleteAction doctype="Student" name={String(r[0])} remove={api.removeDoc} onDone={reload} />
            </div></TableCell>
          </>)} />
        </>
      ) : <Placeholder name={tab} note="Alumni records, transfers, admission-form fields & history." />}
      <StudentProfileDrawer id={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}

/* ===================== HR (HRMS surface) ===================== */
function HRScreen({ d }: Ctx) {
  const [tab, setTab] = useState("Employees");
  const eCols = ["Name", "Designation", "Department", "Joined", "Status", "Branch"];
  const lCols = ["Employee", "Leave Type", "From", "To", "Days", "Status"];
  const pCols = ["Employee", "Period", "Gross (₹)", "Net (₹)", "Status"];
  const dCols = ["Department", "Parent", "Employees"];
  const te = useTable(d.hrEmployees);
  const tl = useTable(d.leaveApps);
  const tp = useTable(d.salarySlips);
  const tdp = useTable(d.departments);
  const note = (txt: string) => <p className="text-[12px] mb-3" style={{ color: C.mute }}>{txt}</p>;
  return (
    <div>
      <PageHead title="Human Resources" />
      <UTabs tabs={["Employees", "Leave", "Payroll", "Departments"]} value={tab} onChange={setTab} />
      {tab === "Employees" && (
        <DataTable cols={eCols} t={te} exportName="hr-employees" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
          <TableCell>{r[3]}</TableCell><TableCell><StatusBadge text={r[4]} /></TableCell><TableCell>{r[5]}</TableCell>
        </>)} />
      )}
      {tab === "Leave" && (<>
        {note("Staff apply and managers approve leave in the HR app; applications and balances surface here.")}
        <DataTable cols={lCols} t={tl} exportName="leave" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
          <TableCell>{r[3]}</TableCell><TableCell>{r[4]}</TableCell><TableCell><StatusBadge text={r[5]} /></TableCell>
        </>)} />
      </>)}
      {tab === "Payroll" && (<>
        {note("Payroll is processed in the HR app (salary structures, runs); generated salary slips surface here.")}
        <DataTable cols={pCols} t={tp} exportName="payroll" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>₹{r[2]}</TableCell>
          <TableCell style={{ color: C.green }}>₹{r[3]}</TableCell><TableCell><StatusBadge text={r[4]} /></TableCell>
        </>)} />
      </>)}
      {tab === "Departments" && (
        <DataTable cols={dCols} t={tdp} exportName="departments" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell>
          <TableCell><span className="font-semibold">{r[2]}</span> <span style={{ color: C.mute }}>staff</span></TableCell>
        </>)} />
      )}
    </div>
  );
}

/* ===================== ACADEMIC SETUP ===================== */
function AcademicScreen({ d, reload }: Ctx) {
  const [tab, setTab] = useState("Academic Years");
  const yCols = ["Academic Year", "Start", "End", "Status"];
  const pCols = ["Program / Class", "Abbreviation", "Enrolled"];
  const hCols = ["Holiday List", "From", "To", "Holidays", ""];
  const ty = useTable(d.academicYears);
  const tp = useTable(d.programs);
  const th = useTable(d.holidayLists);
  return (
    <div>
      <PageHead title="Academic Setup">
        {tab === "Academic Years" && (
          <AddButton label="Add Academic Year" icon={Plus} title="Add Academic Year" onDone={reload} submit={api.addAcademicYear}
            fields={[
              { name: "name", label: "Name (e.g. 2027-2028)", required: true },
              { name: "start", label: "Start Date", type: "date", required: true },
              { name: "end", label: "End Date", type: "date", required: true },
            ]} />
        )}
        {tab === "Classes & Programs" && (
          <AddButton label="Add Program" icon={Plus} title="Add Program / Class" onDone={reload} submit={api.addProgram}
            fields={[
              { name: "name", label: "Program / Class Name", required: true },
              { name: "abbr", label: "Abbreviation" },
            ]} />
        )}
        {tab === "Holiday Calendar" && (
          <AddButton label="Add Holiday List" icon={Plus} title="Add Holiday List" onDone={reload} submit={api.addHolidayList}
            fields={[
              { name: "name", label: "List Name", required: true },
              { name: "from_date", label: "From", type: "date", required: true },
              { name: "to_date", label: "To", type: "date", required: true },
            ]} />
        )}
      </PageHead>
      <UTabs tabs={["Academic Years", "Classes & Programs", "Holiday Calendar"]} value={tab} onChange={setTab} />
      {tab === "Academic Years" && (
        <DataTable cols={yCols} t={ty} exportName="academic-years" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
          <TableCell>{r[3] === "Current" ? <StatusBadge text="Active" /> : <span style={{ color: C.mute }}>—</span>}</TableCell>
        </>)} />
      )}
      {tab === "Classes & Programs" && (
        <DataTable cols={pCols} t={tp} exportName="programs" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell>
          <TableCell><span className="font-semibold">{r[2]}</span> <span style={{ color: C.mute }}>students</span></TableCell>
        </>)} />
      )}
      {tab === "Holiday Calendar" && (
        <DataTable cols={hCols} t={th} exportName="holiday-lists" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell><TableCell>{r[3]}</TableCell>
          <TableCell><DeleteAction doctype="Holiday List" name={String(r[0])} remove={api.removeDoc} onDone={reload} /></TableCell>
        </>)} />
      )}
    </div>
  );
}

/* ===================== FEES ===================== */
function Fees({ d, reload }: Ctx) {
  const [tab, setTab] = useState("View");
  const f = d.feeOverview;
  const vCols = ["Student", "School", "Class", "Pending", "Collected", "Fine", "Total"];
  const sCols = ["Fee Structure", "Program", "Academic Year", "Total (₹)"];
  const rCols = ["Receipt", "Student", "Date", "Amount (₹)", "Mode", "Reference"];
  const oCols = ["Invoice", "Student", "Branch", "Total (₹)", "Outstanding (₹)", "Date", ""];
  const tv = useTable(d.feeRows);
  const ts = useTable(d.feeStructures);
  const tr = useTable(d.receipts);
  const to = useTable(d.outstanding);
  return (
    <div>
      <PageHead title="Fees" />
      <UTabs tabs={["View", "Fee Structures", "Receipts", "Payment Verification"]} value={tab} onChange={setTab} />

      {tab === "View" && (
        <>
          <FilterBar onReset={tv.reset} onExport={() => tv.exportCsv("fees", vCols)}>
            <Field label="Branch"><FilterSelect placeholder="Select Branch" options={branchOpts(d)} /></Field>
          </FilterBar>
          <div className="grid grid-cols-3 gap-4 mb-[18px]">
            {[["Total Fee", f?.total ?? 0, C.ink], ["Collected Fee", f?.collected ?? 0, C.green], ["Pending Fee", f?.pending ?? 0, C.red]].map(([l, v, c]) => (
              <Card key={l as string} className="px-[22px] py-5 rounded-2xl"><div className="text-[12.5px]" style={{ color: C.mute }}>{l as string}</div>
                <div className="text-[24px] font-extrabold mt-1" style={{ color: c as string }}>{inr(v as number)}</div></Card>
            ))}
          </div>
          <DataTable cols={vCols} t={tv} render={(r) => (<>
            <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
            <TableCell style={{ color: C.red }}>{inr(r[3])}</TableCell><TableCell style={{ color: C.green }}>{inr(r[4])}</TableCell>
            <TableCell>—</TableCell><TableCell className="font-bold">{inr(r[5])}</TableCell>
          </>)} />
        </>
      )}

      {tab === "Fee Structures" && (
        <DataTable cols={sCols} t={ts} exportName="fee-structures" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell><TableCell>₹{r[3]}</TableCell>
        </>)} />
      )}

      {tab === "Receipts" && (
        <DataTable cols={rCols} t={tr} exportName="receipts" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
          <TableCell style={{ color: C.green }}>₹{r[3]}</TableCell><TableCell>{r[4]}</TableCell><TableCell className="text-[12px]" style={{ color: C.mute }}>{r[5]}</TableCell>
        </>)} />
      )}

      {tab === "Payment Verification" && (
        <DataTable cols={oCols} t={to} render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
          <TableCell>₹{r[3]}</TableCell><TableCell style={{ color: C.red }}>₹{r[4]}</TableCell><TableCell>{r[5]}</TableCell>
          <TableCell><PaymentAction invoice={String(r[0])} outstanding={String(r[4])} submit={api.recordPayment} onDone={reload} /></TableCell>
        </>)} />
      )}
    </div>
  );
}

/* ===================== ATTENDANCE ===================== */
function AttendanceScreen({ d }: Ctx) {
  const [tab, setTab] = useState("Report");
  const [scope, setScope] = useState("Overall");
  const a = d.attendance;
  return (
    <div>
      <PageHead title="Attendance" />
      <UTabs tabs={["Report", "History", "Settings"]} value={tab} onChange={setTab} />
      {tab === "Report" ? (
        <>
          <UTabs tabs={["Overall", "Branch Wise"]} value={scope} onChange={setScope} />
          <Card className="p-[22px] rounded-2xl">
            <div className="flex gap-4 items-end flex-wrap">
              <Field label="Date *"><Input placeholder="Select Date" className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /></Field>
              <Field label="Designation *"><FilterSelect placeholder="Select Designation" options={["Teacher", "Non Teaching", "Cleaning Staff"]} /></Field>
              {scope === "Branch Wise" && <Field label="Branch"><FilterSelect placeholder="Select Branch" options={branchOpts(d)} /></Field>}
              <BrandBtn onClick={() => toast("Attendance shown is today's live total. Date-range reports are a later pass.")}>Show Report</BrandBtn>
            </div>
          </Card>
          <div className="grid grid-cols-4 gap-4 mt-[18px]">
            {[["Present", a?.present ?? 0, C.green], ["Absent", a?.absent ?? 0, C.red], ["On Leave", a?.leave ?? 0, C.amber], ["Total Staff", a?.total ?? 0, C.blue]].map(([l, v, c]) => (
              <Card key={l as string} className="px-5 py-[18px] rounded-2xl"><div className="text-[12.5px]" style={{ color: C.mute }}>{l as string}</div>
                <div className="text-[24px] font-extrabold mt-1" style={{ color: c as string }}>{v as number}</div></Card>
            ))}
          </div>
        </>
      ) : <Placeholder name={tab} note="Historical attendance logs and attendance rules per designation." />}
    </div>
  );
}

/* ===================== BILLING ===================== */
function Billing({ d, reload }: Ctx) {
  const cols = ["Categories", "Date", "Created By", "Status", "Option"];
  const t = useTable(d.billing);
  return (
    <div>
      <PageHead title="Billing">
        <AddButton label="Add Category" icon={Plus} title="Add Category"
          fields={[{ name: "name", label: "Category Name", required: true }]} submit={api.addCategory} onDone={reload} />
      </PageHead>
      <UTabs tabs={["Category"]} value="Category" onChange={() => {}} />
      <DataTable cols={cols} t={t} exportName="billing-categories" render={(r) => (<>
        <TableCell><ChevronRight size={14} color={C.mute} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />{r[0]}</TableCell>
        <TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
        <TableCell><Switch defaultChecked={!!r[3]} /></TableCell>
        <TableCell><div className="flex gap-3 items-center">
          <ViewAction cols={cols} row={r} />
          <DeleteAction doctype="Item Group" name={String(r[0])} remove={api.removeDoc} onDone={reload} />
        </div></TableCell>
      </>)} />
    </div>
  );
}

/* ===================== ENQUIRY / LEAD CRM ===================== */
function Enquiry({ d, reload }: Ctx) {
  const [top, setTop] = useState("Student Enquiry");
  const [sub, setSub] = useState("Enquiry");
  const fn = d.funnel;
  const SRC = ["Website", "Walk-in", "Referral", "Phone", "Social Media", "Other"];
  const STATUS = ["Applied", "Approved", "Admitted", "Rejected"];
  const stats: [number, string, string, React.ComponentType<any>][] = [
    [fn?.total ?? 0, "Total Enquiries", C.blue, Clipboard],
    [fn?.converted ?? 0, "Converted", C.green, CheckCircle],
    [fn?.dropped ?? 0, "Dropped", C.red, XCircle],
    [fn?.followup ?? 0, "Follow-Up", C.yellow, Bell],
  ];
  const cols = ["Enquiry ID", "Name", "Branch", "Class", "Source", "Status", "Date", ""];
  const t = useTable(d.enquiry);
  const addFields: FieldDef[] = [
    { name: "name", label: "Child / Parent Name", required: true },
    { name: "branch", label: "Branch", type: "select", options: branchOpts(d) },
    { name: "program", label: "Class", type: "select", options: CLASSES },
    { name: "source", label: "Source", type: "select", options: SRC },
    { name: "mobile", label: "Mobile" },
  ];
  const statusColor = (s: string) => s === "Admitted" ? C.green : s === "Rejected" ? C.red : s === "Approved" ? "#b5830a" : C.blue;
  return (
    <div>
      <UTabs tabs={["Student Enquiry", "Franchise Enquiry"]} value={top} onChange={setTop} />
      <UTabs tabs={["Enquiry", "Enquiry Sources", "Enquiry Type", "Enquiry Settings", "Pre-Admission Settings"]} value={sub} onChange={setSub} />
      {sub === "Enquiry" ? (
        <>
          <div className="flex justify-end gap-2.5 mb-3">
            <BrandBtn kind="ghost" onClick={() => { navigator.clipboard?.writeText(location.origin + "/enquiry"); toast.success("Public enquiry link copied"); }}>Enquiry Link</BrandBtn>
            <AddButton label="Add Enquiry" icon={Plus} title="Add Enquiry" fields={addFields} submit={api.addEnquiry} onDone={reload} />
          </div>
          <div className="grid grid-cols-4 gap-4 mb-[18px]">
            {stats.map(([v, l, c, Icon]) => (
              <Card key={l} className="px-[22px] py-5 flex flex-row items-center gap-3.5 rounded-2xl">
                <div className="w-[46px] h-[46px] rounded-xl grid place-items-center" style={{ background: c + "1a" }}><Icon size={22} color={c} /></div>
                <div><div className="text-[24px] font-extrabold">{v}</div><div className="text-[12px]" style={{ color: C.mute }}>{l}</div></div>
              </Card>
            ))}
          </div>
          <DataTable cols={cols} t={t} exportName="enquiries" render={(r) => (<>
            <TableCell style={{ color: C.mute }}>{r[0]}</TableCell><TableCell className="font-bold">{r[1]}</TableCell>
            <TableCell>{r[2]}</TableCell><TableCell>{r[3]}</TableCell><TableCell>{r[4]}</TableCell>
            <TableCell><span className="font-semibold" style={{ color: statusColor(String(r[5])) }}>{r[5]}</span></TableCell>
            <TableCell>{r[6]}</TableCell>
            <TableCell><div className="flex gap-3 items-center">
              <EditAction doctype="Student Applicant" name={String(r[0])}
                fields={[
                  { name: "application_status", label: "Status", type: "select", options: STATUS },
                  { name: "custom_source", label: "Source", type: "select", options: SRC },
                ]}
                initial={{ application_status: r[5], custom_source: r[4] === "—" ? "" : r[4] }}
                update={api.updateDoc} onDone={reload} />
              <DeleteAction doctype="Student Applicant" name={String(r[0])} remove={api.removeDoc} onDone={reload} />
            </div></TableCell>
          </>)} />
        </>
      ) : <Placeholder name={sub} note="Lead sources, enquiry types, follow-up rules & pre-admission form." />}
    </div>
  );
}

/* ===================== INVENTORY ===================== */
function Inventory({ d, reload }: Ctx) {
  const cols = ["S.No", "Product Name", "Category", "Status", "Price", "Qty", "Option"];
  const t = useTable(d.inventory);
  const addFields: FieldDef[] = [
    { name: "name", label: "Product Name", required: true },
    { name: "item_group", label: "Category", type: "select", options: ["Products", "Services"] },
    { name: "rate", label: "Price (₹)", type: "number" },
  ];
  return (
    <div>
      <PageHead title="Inventory Management">
        <AddButton label="Add Product" icon={Plus} title="Add Product" fields={addFields} submit={api.addProduct} onDone={reload} />
      </PageHead>
      <DataTable cols={cols} t={t} exportName="inventory" render={(r) => (<>
        <TableCell>{r[0]}</TableCell><TableCell className="font-bold">{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
        <TableCell><span className="font-semibold text-[12px]" style={{ color: r[3] === "Active" ? C.green : C.red }}>● {r[3]}</span></TableCell>
        <TableCell>₹{r[4]}</TableCell><TableCell>{r[5]}</TableCell>
        <TableCell><div className="flex gap-3 items-center">
          <ViewAction cols={cols} row={r} />
          <EditAction doctype="Item" name={String(r[1])} fields={[{ name: "standard_rate", label: "Price (₹)", type: "number" }]}
            initial={{ standard_rate: String(r[4]).replace(/,/g, "") }} update={api.updateDoc} onDone={reload} />
          <DeleteAction doctype="Item" name={String(r[1])} remove={api.removeDoc} onDone={reload} />
        </div></TableCell>
      </>)} />
    </div>
  );
}

/* ===================== KIT ORDERING (workflow) ===================== */
function KitOrdering({ d, reload }: Ctx) {
  const [tab, setTab] = useState("Orders");
  const [st, setSt] = useState("Pending Orders");
  const cols = ["Order Id", "Product / Kit", "Branch", "Order Type", "Payment", "Amount", "Date", "Status", ""];
  const all = d.kitOrderList;
  const match = (s: string) =>
    st === "Pending Orders" ? s === "Pending"
      : st === "Accepted Orders" ? (s === "Accepted" || s === "Dispatched")
        : s === "Completed";
  const filtered = all ? all.filter((r) => match(String(r[7]))) : undefined;
  const t = useTable(filtered);
  const addFields: FieldDef[] = [
    { name: "branch", label: "Branch", type: "select", options: branchOpts(d), required: true },
    { name: "item", label: "Product / Kit", required: true },
    { name: "qty", label: "Quantity", type: "number" },
    { name: "rate", label: "Unit Price (₹)", type: "number" },
  ];
  const bulkAccept = async () => {
    const pend = (all || []).filter((r) => r[7] === "Pending");
    if (!pend.length) return toast("No pending orders to accept");
    try {
      await Promise.all(pend.map((r) => api.setKitStatus({ order: r[8], status: "Accepted" })));
      toast.success(`${pend.length} order(s) accepted`); reload();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  return (
    <div>
      <PageHead title="Kit Ordering">
        <BrandBtn kind="ghost" icon={Package} onClick={bulkAccept}>Bulk Accept</BrandBtn>
        <AddButton label="New Order" icon={Plus} kind="primary" title="New Kit Order" fields={addFields} submit={api.addKitOrder} onDone={reload} />
        <BrandBtn kind="yellow" icon={Download} onClick={() => t.exportCsv("kit-orders", cols)}>Export</BrandBtn>
      </PageHead>
      <UTabs tabs={["Orders", "Old orders", "Settings"]} value={tab} onChange={setTab} />
      {tab === "Orders" ? (
        <>
          <UTabs tabs={["Pending Orders", "Accepted Orders", "Completed Orders"]} value={st} onChange={setSt} />
          <FilterBar withExport={false} onReset={t.reset}>
            <Field label="Branch"><FilterSelect placeholder="Select Branch" options={branchOpts(d)} /></Field>
            <Field label="Order Type"><FilterSelect placeholder="Select Type" options={["Product", "Support"]} /></Field>
          </FilterBar>
          <DataTable cols={cols} t={t} render={(r) => (<>
            <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
            <TableCell><StatusBadge text="Product" /></TableCell><TableCell><StatusBadge text={String(r[4])} /></TableCell>
            <TableCell>₹{r[5]}</TableCell><TableCell>{r[6]}</TableCell>
            <TableCell><StatusBadge text={String(r[7])} /></TableCell>
            <TableCell><KitStatusActions so={String(r[8])} status={String(r[7])} reload={reload} /></TableCell>
          </>)} />
        </>
      ) : <Placeholder name={tab} note="Archived orders & kit-ordering configuration." />}
    </div>
  );
}

/* ===================== INVOICES ===================== */
function Invoices({ d }: Ctx) {
  const cols = ["Sr No", "Order No", "Date", "Invoice", "Amount", "Status", "Option"];
  const t = useTable(d.invoices);
  return (
    <div>
      <PageHead title="Invoices" />
      <DataTable cols={cols} t={t} exportName="invoices" render={(r) => (<>
        <TableCell>{r[0]}</TableCell><TableCell className="font-bold">{r[1]}</TableCell><TableCell>{r[2]}</TableCell>
        <TableCell>{r[3]}</TableCell><TableCell>₹{r[4]}</TableCell><TableCell><StatusBadge text={r[5]} /></TableCell>
        <TableCell><div className="flex gap-2.5 items-center">
          <ViewAction cols={cols} row={r} />
          <button title="Download" onClick={() => toast("PDF export of this invoice is a later pass.")}><Download size={16} color={C.blue} /></button>
        </div></TableCell>
      </>)} />
    </div>
  );
}

/* ===================== CURRICULUM ===================== */
function Curriculum({ d, reload }: Ctx) {
  const [tab, setTab] = useState("Plans");
  const pCols = ["Plan", "School", "Category", "Class", "Status", "Start", "End", ""];
  const cCols = ["Course", "Status", ""];
  const tCols = ["Topic / Weekly Lesson", ""];
  const tp = useTable(d.curriculum);
  const tc = useTable(d.courses);
  const tt = useTable(d.topics);
  return (
    <div>
      <PageHead title="Curriculum">
        {tab === "Courses" && <AddButton label="Add Course" icon={Plus} title="Add Course" fields={[{ name: "name", label: "Course Name", required: true }]} submit={api.addCourse} onDone={reload} />}
        {tab === "Topics" && <AddButton label="Add Topic" icon={Plus} title="Add Topic / Lesson" fields={[{ name: "name", label: "Topic / Weekly Lesson", required: true }]} submit={api.addTopic} onDone={reload} />}
      </PageHead>
      <UTabs tabs={["Plans", "Courses", "Topics"]} value={tab} onChange={setTab} />
      {tab === "Plans" && (
        <>
          <FilterBar withExport={false} onReset={tp.reset}>
            <Field label="Category"><FilterSelect placeholder="Select Category" options={["Academic"]} /></Field>
            <Field label="Class"><FilterSelect placeholder="Select Class" options={CLASSES} /></Field>
          </FilterBar>
          <DataTable cols={pCols} t={tp} exportName="curriculum-plans" render={(r) => (<>
            <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell><TableCell>{r[3]}</TableCell>
            <TableCell><StatusBadge text={r[4]} /></TableCell><TableCell>{r[5]}</TableCell><TableCell>{r[6]}</TableCell>
            <TableCell><ViewAction cols={pCols} row={r} /></TableCell>
          </>)} />
        </>
      )}
      {tab === "Courses" && (
        <DataTable cols={cCols} t={tc} exportName="courses" render={(r) => (<>
          <TableCell className="font-bold">{r[1]}</TableCell><TableCell><StatusBadge text={String(r[2])} /></TableCell>
          <TableCell><DeleteAction doctype="Course" name={String(r[0])} remove={api.removeDoc} onDone={reload} /></TableCell>
        </>)} />
      )}
      {tab === "Topics" && (
        <DataTable cols={tCols} t={tt} exportName="topics" render={(r) => (<>
          <TableCell className="font-bold">{r[1]}</TableCell>
          <TableCell><DeleteAction doctype="Topic" name={String(r[0])} remove={api.removeDoc} onDone={reload} /></TableCell>
        </>)} />
      )}
    </div>
  );
}

/* ===================== SMS / EMAIL ===================== */
function SmsEmail() {
  const [tab, setTab] = useState("Modules");
  return (
    <div>
      <PageHead title="SMS / Email" />
      <UTabs tabs={["Modules", "Logs", "Settings"]} value={tab} onChange={setTab} />
      {tab === "Modules" ? (
        <Card className="p-6 rounded-2xl">
          {Object.entries(SMS_MATRIX).map(([group, items]) => (
            <div key={group} className="mb-5">
              <div className="grid items-center border-b pb-2.5 mb-1.5" style={{ gridTemplateColumns: "1fr 72px 72px", borderColor: "#eef1f7" }}>
                <h3 className="m-0 text-[16px] font-bold">{group}</h3>
                <span className="justify-self-center flex gap-1.5 items-center text-[12.5px] font-bold" style={{ color: C.mute }}><MessageSquare size={14} color={C.mute} /> SMS</span>
                <span className="justify-self-center flex gap-1.5 items-center text-[12.5px] font-bold" style={{ color: C.mute }}><Mail size={14} color={C.mute} /> Email</span>
              </div>
              {items.map(([name, sms, email]) => (
                <div key={name} className="grid items-center py-2.5 border-b" style={{ gridTemplateColumns: "1fr 72px 72px", borderColor: "#f6f8fc" }}>
                  <span className="text-[13.5px]">{name}</span>
                  <Switch className="justify-self-center" defaultChecked={sms} />
                  <Switch className="justify-self-center" defaultChecked={email} />
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-end"><BrandBtn onClick={() => toast("Notification channel config needs an SMS/email gateway — not provisioned here.")}>Save</BrandBtn></div>
        </Card>
      ) : <Placeholder name={tab} note="Delivery logs and gateway credentials." />}
    </div>
  );
}

/* ===================== BROADCAST ===================== */
function Broadcast() {
  const [channel, setChannel] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!message.trim()) return toast.error("Message is required");
    setBusy(true);
    try {
      await api.sendBroadcast({ channel, audience, message });
      toast.success("Broadcast recorded (delivery needs a configured gateway)");
      setMessage("");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <PageHead title="Broadcast"><BrandBtn kind="yellow" icon={Send} onClick={() => setMessage("")}>New Broadcast</BrandBtn></PageHead>
      <Card className="p-6 rounded-2xl">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Channel"><FilterSelect placeholder="Select channel" options={["WhatsApp", "SMS", "Email", "App Notification"]} /></Field>
          <Field label="Audience"><FilterSelect placeholder="Select audience" options={["All Parents", "All Staff", "Specific Branch", "Specific Class"]} /></Field>
        </div>
        <div className="mt-4"><Field label="Message">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your announcement…" className="min-h-[120px] rounded-[9px]" style={{ borderColor: "#d9e0ee" }} />
        </Field></div>
        <div className="flex justify-end mt-4"><BrandBtn icon={Send} onClick={send} disabled={busy}>{busy ? "Sending…" : "Send Broadcast"}</BrandBtn></div>
      </Card>
      <p className="text-[12px] mt-3" style={{ color: C.mute }}>Note: broadcasts are recorded as Notes. Live SMS/WhatsApp/email delivery requires a messaging gateway (e.g. Twilio) to be configured.</p>
    </div>
  );
}

/* ===================== REPORTS ===================== */
function Reports({ d }: Ctx) {
  const [tab, setTab] = useState("Quick Reports");
  const cols = ["Report", "Module", "Requested", "Generated", "Status", ""];
  const t = useTable(d.reports);
  const quick: [string, Row[] | undefined, string[]][] = [
    ["Fee Collection", d.feeRows, ["Student", "Branch", "Class", "Pending", "Collected", "Total"]],
    ["Receipts", d.receipts, ["Receipt", "Student", "Date", "Amount", "Mode", "Reference"]],
    ["Enquiries / Admissions", d.enquiry, ["Enquiry ID", "Name", "Branch", "Class", "Source", "Status", "Date"]],
    ["Kit Orders", d.kitOrderList, ["Order Id", "Kit", "Branch", "Type", "Payment", "Amount", "Date", "Status", "SO"]],
    ["Inventory", d.inventory, ["S.No", "Product", "Category", "Status", "Price", "Qty"]],
    ["Students", d.students, ["Adm No", "Name", "Branch", "Class", "Phone", "Status"]],
    ["Staff", d.staff, ["Name", "Branch", "Designation", "Username", "Phone", "Status"]],
    ["Branches", d.branches, ["Branch ID", "Name", "Email", "Phone", "Status"]],
  ];
  return (
    <div>
      <PageHead title="Report Center" />
      <UTabs tabs={["Quick Reports", "System Reports"]} value={tab} onChange={setTab} />
      {tab === "Quick Reports" ? (
        <div className="grid grid-cols-3 gap-4">
          {quick.map(([label, data, rcols]) => (
            <Card key={label} className="p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-xl grid place-items-center" style={{ background: C.blueSoft }}><FileText size={20} color={C.blue} /></div>
                <div><div className="font-bold text-[14px]">{label}</div><div className="text-[11.5px]" style={{ color: C.mute }}>{(data || []).length} rows · live</div></div>
              </div>
              <BrandBtn kind="yellow" icon={Download}
                onClick={() => { if (!data || !data.length) return toast("No data to export yet"); downloadCsv(label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), rcols, data); }}>
                Download CSV
              </BrandBtn>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Card className="p-[22px] rounded-2xl mb-[18px]">
            <div className="flex gap-4 flex-wrap items-end">
              <Field label="Module"><FilterSelect placeholder="Select Module" options={["Education", "Selling", "Accounts", "HR", "Stock"]} /></Field>
              <Field label="Status"><FilterSelect placeholder="Select Status" options={["Completed", "Disabled"]} /></Field>
              <BrandBtn onClick={t.reset}>Reset</BrandBtn>
            </div>
          </Card>
          <DataTable cols={cols} t={t} exportName="reports" render={(r) => (<>
            <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell>{r[2]}</TableCell><TableCell>{r[3]}</TableCell>
            <TableCell><StatusBadge text={r[4]} /></TableCell>
            <TableCell><button title="Open" onClick={() => window.open(`/app/query-report/${encodeURIComponent(String(r[0]))}`, "_blank")}><Download size={16} color={C.blue} /></button></TableCell>
          </>)} />
        </>
      )}
    </div>
  );
}

/* ===================== SETTINGS ===================== */
function SettingsScreen({ d, reload }: Ctx) {
  const [tab, setTab] = useState("General");
  const s = d.settings || {};
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const tu = useTable(d.hqUsers);
  React.useEffect(() => { setEmail(s.email || ""); setPhone(s.phone || ""); }, [s.email, s.phone]);
  const save = async () => {
    setBusy(true);
    try { await api.saveSettings({ email, phone }); toast.success("Settings saved"); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <PageHead title="Settings">
        {tab === "Global Rights" && (
          <AddButton label="Grant Access" icon={Plus} title="Grant HQ Access" submit={api.grantHq} onDone={reload}
            fields={[{ name: "email", label: "User Email (must already exist in Frappe)", required: true }]} />
        )}
      </PageHead>
      <UTabs tabs={["General", "Branch Config", "Global Rights", "Website", "Holiday Calendar"]} value={tab} onChange={setTab} />
      {tab === "General" && (
        <Card className="p-6 rounded-2xl">
          <div className="grid grid-cols-2 gap-[18px]">
            <Field label="System Name *"><Input key={s.systemName} defaultValue={s.systemName || ""} readOnly className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /></Field>
            <Field label="System Title *"><Input key={s.systemTitle} defaultValue={s.systemTitle || ""} className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /></Field>
            <Field label="Address *"><Input defaultValue="209-c, HBR Layout, Bengaluru" className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /></Field>
            <Field label="Phone *"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9008109091" className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /></Field>
            <Field label="System Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="franchise@rosemountedu.com" className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /></Field>
            <Field label="Skin Color *"><div className="flex gap-2.5 items-center"><Input defaultValue="#2456c4" className="rounded-[9px]" style={{ borderColor: "#d9e0ee" }} /><span className="w-[38px] h-[38px] rounded-[9px] shrink-0" style={{ background: C.blue }} /></div></Field>
          </div>
          <div className="flex justify-end mt-[18px]"><BrandBtn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Settings"}</BrandBtn></div>
        </Card>
      )}
      {tab === "Global Rights" && (<>
        <p className="text-[12px] mb-3" style={{ color: C.mute }}>Users with the <b>HQ Dashboard</b> role can open this console. Grant access to existing Frappe users; revoke anytime.</p>
        <DataTable cols={["User Email", "Name", "Status", ""]} t={tu} exportName="hq-users" render={(r) => (<>
          <TableCell className="font-bold">{r[0]}</TableCell><TableCell>{r[1]}</TableCell>
          <TableCell><StatusBadge text={r[2] === "Enabled" ? "Active" : "Inactive"} /></TableCell>
          <TableCell><DeleteAction doctype="HQ access" name={String(r[0])} remove={(_, email) => api.revokeHq(email)} onDone={reload} /></TableCell>
        </>)} />
      </>)}
      {tab !== "General" && tab !== "Global Rights" && (
        <Placeholder name={tab} note="Branch-level config, website content and holiday calendar." />
      )}
    </div>
  );
}

export const SCREENS: Record<string, (ctx: Ctx) => React.ReactNode> = {
  Dashboard, Branches, Staff, HR: HRScreen, Students, Academic: AcademicScreen, Fees, Attendance: AttendanceScreen, Billing,
  Enquiry, Inventory, "Kit Ordering": KitOrdering, Invoices, Curriculum,
  "SMS / Email": SmsEmail, Broadcast, Reports, Settings: SettingsScreen,
};
