// Same-origin Frappe API layer (served inside Frappe → session cookie auth).
export type Row = (string | number)[];

async function call<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const qs = new URLSearchParams(clean as Record<string, string>).toString();
  const url = `/api/method/rosemount_dashboard.api.${method}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/login?redirect-to=/rmdashboard";
    throw new Error("auth");
  }
  if (!res.ok) throw new Error(`${method} → ${res.status}`);
  const data = await res.json();
  return data.message as T;
}

async function post<T = any>(method: string, body: Record<string, any> = {}): Promise<T> {
  const res = await fetch(`/api/method/rosemount_dashboard.api.${method}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Frappe-CSRF-Token": (window as any).csrf_token || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Frappe puts the thrown message in _server_messages / exception
    let msg = `${method} → ${res.status}`;
    try {
      const sm = JSON.parse(data._server_messages || "[]");
      if (sm.length) msg = JSON.parse(sm[0]).message || msg;
    } catch { /* ignore */ }
    throw new Error(msg.replace(/<[^>]+>/g, ""));
  }
  return data.message as T;
}

export interface Summary { branches: number; branchesActive: number; students: number; staff: number; pendingAdmissions: number; }
export interface FeeOverview { total: number; collected: number; pending: number; }
export interface Funnel { total: number; converted: number; dropped: number; followup: number; }
export interface Attendance { present: number; absent: number; leave: number; total: number; }

export const api = {
  summary: (branch?: string) => call<Summary>("dashboard_summary", { branch }),
  feeOverview: (branch?: string) => call<FeeOverview>("fee_overview", { branch }),
  feeByBranch: () => call<{ branch: string; value: number }[]>("fee_by_branch"),
  feeTrend: (branch?: string) => call<{ m: string; collected: number; pending: number }[]>("fee_collection_trend", { branch }),
  funnel: (branch?: string) => call<Funnel>("admissions_funnel", { branch }),
  kitOrders: (branch?: string) => call<Row[]>("pending_kit_orders", { branch }),
  attendance: (branch?: string) => call<Attendance>("attendance_today", { branch }),
  branches: () => call<Row[]>("branches"),
  staff: (branch?: string) => call<Row[]>("staff_list", { branch }),
  students: (branch?: string) => call<Row[]>("student_list", { branch }),
  feeRows: (branch?: string) => call<Row[]>("fee_rows", { branch }),
  inventory: () => call<Row[]>("inventory_list"),
  invoices: (branch?: string) => call<Row[]>("invoice_list", { branch }),
  billing: () => call<Row[]>("billing_categories"),
  curriculum: () => call<Row[]>("curriculum_list"),
  reports: () => call<Row[]>("reports_list"),
  settings: () => call<any>("settings_info"),
  academicYears: () => call<Row[]>("academic_years"),
  programsList: () => call<Row[]>("programs_list"),
  holidayLists: () => call<Row[]>("holiday_lists"),
  feeStructures: () => call<Row[]>("fee_structures"),
  receipts: (branch?: string) => call<Row[]>("receipts", { branch }),
  outstandingInvoices: (branch?: string) => call<Row[]>("outstanding_invoices", { branch }),
  enquiryList: (branch?: string) => call<Row[]>("enquiry_list", { branch }),
  kitOrderList: (branch?: string) => call<Row[]>("kit_order_list", { branch }),
  hrEmployees: (branch?: string) => call<Row[]>("hr_employees", { branch }),
  leaveApplications: (branch?: string) => call<Row[]>("leave_applications", { branch }),
  salarySlips: () => call<Row[]>("salary_slips"),
  departmentsList: () => call<Row[]>("departments_list"),
  coursesList: () => call<Row[]>("courses_list"),
  topicsList: () => call<Row[]>("topics_list"),
  hqUsers: () => call<Row[]>("hq_users"),
  clearCache: () => call("clear_cache"),

  // ---- writes (POST + CSRF) ----
  addBranch: (v: any) => post("add_branch", v),
  addStaff: (v: any) => post("add_staff", v),
  addStudent: (v: any) => post("add_student", v),
  addProduct: (v: any) => post("add_product", v),
  addCategory: (v: any) => post("add_category", v),
  updateDoc: (doctype: string, name: string, values: any) => post("update_doc", { doctype, name, values: JSON.stringify(values) }),
  removeDoc: (doctype: string, name: string) => post("remove_doc", { doctype, name }),
  saveSettings: (v: any) => post("save_settings", { values: JSON.stringify(v) }),
  sendBroadcast: (v: any) => post("send_broadcast", v),
  addAcademicYear: (v: any) => post("add_academic_year", v),
  addProgram: (v: any) => post("add_program", v),
  addHolidayList: (v: any) => post("add_holiday_list", v),
  recordPayment: (v: any) => post("record_payment", v),
  addEnquiry: (v: any) => post("add_enquiry", v),
  setKitStatus: (v: any) => post("set_kit_status", v),
  addKitOrder: (v: any) => post("add_kit_order", v),
  addCourse: (v: any) => post("add_course", v),
  addTopic: (v: any) => post("add_topic", v),
  grantHq: (v: any) => post("grant_hq", v),
  revokeHq: (email: string) => post("revoke_hq", { email }),
};

export const inr = (n: number | string) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const compact = (n: number) => {
  n = Number(n || 0);
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  return inr(n);
};
export const stripRmips = (s: string) => (s || "").replace(/^RMIPS /, "");
