import * as React from "react";
import { useEffect, useState } from "react";
import { Sidebar, Topbar, C } from "@/lib/ui";
import { SCREENS } from "@/screens";
import type { Ctx } from "@/screens";
import { api } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const [active, setActive] = useState("Dashboard");
  const [branch, setBranch] = useState("");
  const [d, setD] = useState<Ctx["d"]>({});
  const [branchNames, setBranchNames] = useState<string[]>([]);
  const [err, setErr] = useState("");

  async function load(b: string) {
    setErr("");
    setD({}); // show skeletons while (re)loading
    try {
      const [summary, feeOverview, feeByBranch, feeTrend, funnel, kitOrders, attendance,
             branches, staff, students, feeRows, inventory, invoices, billing, curriculum, reports, settings,
             academicYears, programs, holidayLists, feeStructures, receipts, outstanding, enquiry, kitOrderList,
             hrEmployees, leaveApps, salarySlips, departments, courses, topics, hqUsers,
             events, stuAttendance, attTrend, attRows] =
        await Promise.all([
          api.summary(b), api.feeOverview(b), api.feeByBranch(), api.feeTrend(b),
          api.funnel(b), api.kitOrders(b), api.attendance(b), api.branches(),
          api.staff(b), api.students(b), api.feeRows(b), api.inventory(), api.invoices(b),
          api.billing(), api.curriculum(), api.reports(), api.settings(),
          api.academicYears(), api.programsList(), api.holidayLists(),
          api.feeStructures(), api.receipts(b), api.outstandingInvoices(b), api.enquiryList(b),
          api.kitOrderList(b),
          api.hrEmployees(b), api.leaveApplications(b), api.salarySlips(), api.departmentsList(),
          api.coursesList(), api.topicsList(), api.hqUsers(),
          api.upcomingEvents(), api.studentAttendanceToday(b), api.attendanceTrend(b),
          api.studentAttendanceRows(b),
        ]);
      setD({ summary, feeOverview, feeByBranch, feeTrend, funnel, kitOrders, attendance,
             branches, staff, students, feeRows, inventory, invoices, billing, curriculum, reports, settings,
             academicYears, programs, holidayLists, feeStructures, receipts, outstanding, enquiry, kitOrderList,
             hrEmployees, leaveApps, salarySlips, departments, courses, topics, hqUsers,
             events, stuAttendance, attTrend, attRows });
      setBranchNames(branches.map((r) => String(r[1])));
    } catch (e: any) {
      if (e?.message !== "auth") setErr("Could not load dashboard data: " + (e?.message || e));
    }
  }
  useEffect(() => { load(branch); /* eslint-disable-next-line */ }, [branch]);

  const Screen = (SCREENS[active] || SCREENS.Dashboard) as React.FC<Ctx>;
  return (
    <div className="flex min-h-screen" style={{ background: C.page, color: C.ink }}>
      <Sidebar active={active} onNav={setActive} />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar branch={branch} branches={branchNames} onBranch={setBranch} />
        <div className="p-6 overflow-y-auto">
          {err && <div className="mb-4 p-3 rounded-lg" style={{ background: C.redSoft, color: C.red }}>{err}</div>}
          <div className="rm-screen" key={active}><Screen branch={branch} d={d} reload={() => load(branch)} /></div>
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
