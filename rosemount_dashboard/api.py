# Copyright (c) 2026, Rosemount International Preschool and contributors
# For license information, please see license.txt
"""
Rosemount Dashboard — whitelisted aggregation endpoints.

These power the single HQ dashboard page (rosemount_dashboard/www/rmdashboard).
Every public method is GET-callable at:

    /api/method/rosemount_dashboard.api.<method>

Data sources on this bench (verified against live metadata, site `rosemount`):
  * Branch dimension == ERPNext **Branch** doctype (one Company, many Branches).
    Most doctypes get a `custom_branch` (Link -> Branch) field at install time;
    Employee uses its native `branch` field; Attendance is scoped via the
    employee's branch.
  * Students / admissions -> Frappe Education (`Student`, `Student Applicant`,
    `Program Enrollment`).
  * Money metrics come from submitted **Sales Invoice** (native `student` link
    in Education v16), NOT the legacy `Fees` doctype.

See README.md for the full field/status mapping.
"""

import frappe
from frappe.utils import flt, today, nowdate, getdate, add_months, formatdate, fmt_money


# =============================================================================
# Branch-scoping helper — single source of truth
# =============================================================================
# Branch == ERPNext Branch doctype. The `branch` argument every endpoint accepts
# is a Branch name (e.g. "RMIPS Horamavu").
BRANCH_FIELD = "custom_branch"

_BRANCH_FIELD_BY_DOCTYPE = {
    "Sales Invoice": "custom_branch",
    "Sales Order": "custom_branch",
    "Fees": "custom_branch",
    "Student": "custom_branch",
    "Student Applicant": "custom_branch",
    "Program Enrollment": "custom_branch",
    "Employee": "branch",          # native HRMS field
    "Branch": "name",
    # Attendance has no branch field -> scoped via Employee.branch (attendance_today).
}


def _branch_field(doctype=None):
    if not doctype:
        return BRANCH_FIELD
    return _BRANCH_FIELD_BY_DOCTYPE.get(doctype, BRANCH_FIELD)


def _has_field(doctype, fieldname):
    if fieldname == "name":
        return True
    try:
        return bool(frappe.get_meta(doctype).has_field(fieldname))
    except Exception:
        return False


def branch_filter(branch, doctype=None):
    """Return a filters list scoped to a branch, or [] for all branches.

    Maps per-doctype (see _BRANCH_FIELD_BY_DOCTYPE). Falls back to [] (all
    branches) if the resolved field is absent, rather than raising.
    """
    if not branch:
        return []
    field = _branch_field(doctype)
    if doctype and not _has_field(doctype, field):
        return []
    return [[field, "=", branch]]


def _branch_sql(doctype, branch, vals):
    """SQL WHERE fragment scoping `doctype` to `branch`, filling `vals`. "" if unscoped."""
    if not branch:
        return ""
    field = _branch_field(doctype)
    if not _has_field(doctype, field):
        return ""
    vals["__branch"] = branch
    return "`%s` = %%(__branch)s" % field


# =============================================================================
# Access control — HQ only
# =============================================================================
def _require_hq():
    """Server-side gate. The page also redirects Guests to /login, but this is the
    real gate for the API."""
    roles = frappe.get_roles()
    if "HQ Dashboard" not in roles and "System Manager" not in roles:
        frappe.throw("Not permitted", frappe.PermissionError)


# =============================================================================
# Caching — 5-minute Redis cache keyed by method + branch
# =============================================================================
def _cache_key(method, branch=None, extra=None):
    key = "rmd::%s::%s" % (method, branch or "all")
    if extra:
        key += "::%s" % extra
    return key


def _cached(key, fn, ttl=300):
    val = frappe.cache().get_value(key)
    if val is None:
        val = fn()
        frappe.cache().set_value(key, val, expires_in_sec=ttl)
    return val


@frappe.whitelist()
def clear_cache():
    """Drop every rmd:: cache entry (handy after data imports)."""
    _require_hq()
    frappe.cache().delete_keys("rmd::")
    return "cleared"


# =============================================================================
# Small shared helpers
# =============================================================================
def _strip(name):
    """'RMIPS Horamavu' -> 'Horamavu' for compact chart labels."""
    if not name:
        return name
    for prefix in ("RMIPS ", "RMKA "):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def _current_academic_year():
    ay = frappe.get_all(
        "Academic Year",
        filters=[["year_start_date", "<=", nowdate()], ["year_end_date", ">=", nowdate()]],
        fields=["name"], limit=1,
    )
    if ay:
        return ay[0].name
    ay = frappe.get_all("Academic Year", fields=["name"], order_by="year_start_date desc", limit=1)
    return ay[0].name if ay else None


def _student_fields(base):
    fields = list(base)
    if _has_field("Student", "custom_branch"):
        fields.append("custom_branch")
    return fields


def _branch_list_fields():
    """Only request Branch custom fields that actually exist."""
    fields = ["name"]
    for f in ("custom_branch_code", "custom_email", "custom_phone", "custom_status"):
        if _has_field("Branch", f):
            fields.append(f)
    return fields


# =============================================================================
# 1. dashboard_summary
# =============================================================================
@frappe.whitelist()
def dashboard_summary(branch=None):
    _require_hq()

    def build():
        if branch:
            branches = 1 if frappe.db.exists("Branch", branch) else 0
            active = branches if _branch_active(branch) else 0
        else:
            branches = frappe.db.count("Branch")
            active = (
                frappe.db.count("Branch", {"custom_status": "Active"})
                if _has_field("Branch", "custom_status") else branches
            )

        ay = _current_academic_year()
        students = _enrolled_student_count(branch, ay)
        staff = frappe.db.count("Employee", [["status", "=", "Active"]] + branch_filter(branch, "Employee"))
        pending = frappe.db.count(
            "Student Applicant",
            [["application_status", "=", "Applied"]] + branch_filter(branch, "Student Applicant"),
        )
        return {
            "branches": branches,
            "branchesActive": active,
            "students": students,
            "staff": staff,
            "pendingAdmissions": pending,
        }

    return _cached(_cache_key("dashboard_summary", branch), build)


def _branch_active(branch):
    if not _has_field("Branch", "custom_status"):
        return True
    return frappe.db.get_value("Branch", branch, "custom_status") != "Inactive"


def _enrolled_student_count(branch, academic_year):
    conds = ["pe.docstatus < 2"]
    vals = {}
    join = ""
    if academic_year:
        conds.append("pe.academic_year = %(ay)s")
        vals["ay"] = academic_year
    if branch and _has_field("Student", "custom_branch"):
        join = "join `tabStudent` s on s.name = pe.student"
        conds.append("s.custom_branch = %(b)s")
        vals["b"] = branch
    q = "select count(distinct pe.student) from `tabProgram Enrollment` pe %s where %s" % (
        join, " and ".join(conds),
    )
    return frappe.db.sql(q, vals)[0][0] or 0


# =============================================================================
# 2. fee_overview  (raw ₹)
# =============================================================================
@frappe.whitelist()
def fee_overview(branch=None):
    _require_hq()

    def build():
        conds = ["docstatus = 1"]
        vals = {}
        bf = _branch_sql("Sales Invoice", branch, vals)
        if bf:
            conds.append(bf)
        row = frappe.db.sql(
            """
            select coalesce(sum(grand_total), 0)                        as total,
                   coalesce(sum(grand_total - outstanding_amount), 0)   as collected,
                   coalesce(sum(outstanding_amount), 0)                 as pending
            from `tabSales Invoice`
            where %s
            """
            % " and ".join(conds),
            vals, as_dict=True,
        )[0]
        return {
            "total": flt(row.total, 2),
            "collected": flt(row.collected, 2),
            "pending": flt(row.pending, 2),
        }

    return _cached(_cache_key("fee_overview", branch), build)


# =============================================================================
# 3. fee_by_branch  (value in ₹ lakh)
# =============================================================================
@frappe.whitelist()
def fee_by_branch():
    _require_hq()

    def build():
        if not _has_field("Sales Invoice", "custom_branch"):
            return []
        rows = frappe.db.sql(
            """
            select custom_branch as branch, coalesce(sum(grand_total), 0) as value
            from `tabSales Invoice`
            where docstatus = 1 and custom_branch is not null and custom_branch != ''
            group by custom_branch
            order by value desc
            """,
            as_dict=True,
        )
        return [{"branch": _strip(r.branch), "value": flt((r.value or 0) / 1e5, 2)} for r in rows]

    return _cached(_cache_key("fee_by_branch"), build)


# =============================================================================
# 4. fee_collection_trend  (last 6 months, values in ₹ lakh)
# =============================================================================
@frappe.whitelist()
def fee_collection_trend(branch=None):
    _require_hq()

    def build():
        first_of_month = getdate(nowdate()).replace(day=1)
        seq = [getdate(add_months(first_of_month, -i)) for i in range(5, -1, -1)]

        vals = {}
        conds = ["docstatus = 1"]
        bf = _branch_sql("Sales Invoice", branch, vals)
        if bf:
            conds.append(bf)
        vals["__start"] = seq[0]
        conds.append("posting_date >= %(__start)s")

        rows = frappe.db.sql(
            """
            select YEAR(posting_date)                                   as yr,
                   MONTH(posting_date)                                  as mo,
                   coalesce(sum(grand_total - outstanding_amount), 0)   as collected,
                   coalesce(sum(outstanding_amount), 0)                 as pending
            from `tabSales Invoice`
            where %s
            group by YEAR(posting_date), MONTH(posting_date)
            """
            % " and ".join(conds),
            vals, as_dict=True,
        )
        bucket = {(r.yr, r.mo): r for r in rows}

        out = []
        for m in seq:
            r = bucket.get((m.year, m.month))
            out.append({
                "m": m.strftime("%b"),
                "collected": flt((r.collected if r else 0) / 1e5, 2),
                "pending": flt((r.pending if r else 0) / 1e5, 2),
            })
        return out

    return _cached(_cache_key("fee_collection_trend", branch), build)


# =============================================================================
# 5. admissions_funnel
# =============================================================================
@frappe.whitelist()
def admissions_funnel(branch=None):
    _require_hq()

    def build():
        vals = {}
        conds = ["1 = 1"]
        bf = _branch_sql("Student Applicant", branch, vals)
        if bf:
            conds.append(bf)
        rows = frappe.db.sql(
            "select application_status as st, count(name) as c "
            "from `tabStudent Applicant` where %s group by application_status"
            % " and ".join(conds),
            vals, as_dict=True,
        )
        by = {r.st: r.c for r in rows}
        # application_status options: Applied | Approved | Rejected | Admitted
        return {
            "total": sum(by.values()),
            "converted": by.get("Admitted", 0),
            "dropped": by.get("Rejected", 0),
            "followup": by.get("Applied", 0) + by.get("Approved", 0),
        }

    return _cached(_cache_key("admissions_funnel", branch), build)


# =============================================================================
# 6. pending_kit_orders  (Sales Order not yet completed, limit 10)
# =============================================================================
@frappe.whitelist()
def pending_kit_orders(branch=None):
    _require_hq()

    def build():
        filters = [["docstatus", "=", 1], ["status", "not in", ["Completed", "Closed", "Cancelled"]]]
        filters += branch_filter(branch, "Sales Order")
        fields = ["name", "order_type", "transaction_date",
                  "grand_total", "advance_payment_status", "per_billed"]
        if _has_field("Sales Order", "custom_branch"):
            fields.append("custom_branch")
        orders = frappe.get_all(
            "Sales Order", filters=filters, fields=fields,
            order_by="transaction_date desc", limit=10,
        )
        out = []
        for so in orders:
            item = frappe.db.get_value("Sales Order Item", {"parent": so.name}, "item_name") or ""
            paid = (so.advance_payment_status == "Fully Paid") or (flt(so.per_billed) >= 100)
            amount = fmt_money(flt(so.grand_total), precision=0, currency="INR")
            amount = amount.replace("₹", "").replace("INR", "").strip()
            out.append([
                so.name,
                item,
                so.get("custom_branch") or "",
                so.order_type or "Sales",
                "Success" if paid else "Pending",
                amount,
                formatdate(so.transaction_date, "d MMM yyyy") if so.transaction_date else "",
            ])
        return out

    return _cached(_cache_key("pending_kit_orders", branch), build)


# =============================================================================
# 7. attendance_today  (scoped via the employee's branch)
# =============================================================================
@frappe.whitelist()
def attendance_today(branch=None):
    _require_hq()

    def build():
        vals = {"__today": today()}
        join = ""
        conds = ["a.attendance_date = %(__today)s", "a.docstatus = 1"]
        if branch:
            join = "join `tabEmployee` e on e.name = a.employee"
            conds.append("e.branch = %(__b)s")
            vals["__b"] = branch
        rows = frappe.db.sql(
            "select a.status as status, count(a.name) as c "
            "from `tabAttendance` a %s where %s group by a.status"
            % (join, " and ".join(conds)),
            vals, as_dict=True,
        )
        by = {r.status: r.c for r in rows}
        # status options: Present | Absent | On Leave | Half Day | Work From Home
        present = by.get("Present", 0) + by.get("Work From Home", 0) + by.get("Half Day", 0)
        total = frappe.db.count("Employee", [["status", "=", "Active"]] + branch_filter(branch, "Employee"))
        return {
            "present": present,
            "absent": by.get("Absent", 0),
            "leave": by.get("On Leave", 0),
            "total": total,
        }

    return _cached(_cache_key("attendance_today", branch), build)


# =============================================================================
# 8. branches
# =============================================================================
@frappe.whitelist()
def branches():
    _require_hq()

    def build():
        rows = frappe.get_all("Branch", fields=_branch_list_fields(), order_by="name")
        return [[
            r.get("custom_branch_code") or r.name,
            r.name,
            r.get("custom_email") or "",
            r.get("custom_phone") or "",
            r.get("custom_status") or "Active",
        ] for r in rows]

    return _cached(_cache_key("branches"), build)


# =============================================================================
# 9. staff_list  (no "Verified" custom field on Employee -> omitted)
# =============================================================================
@frappe.whitelist()
def staff_list(branch=None):
    _require_hq()

    def build():
        rows = frappe.get_all(
            "Employee", filters=branch_filter(branch, "Employee"),
            # employee_number holds the SchoolBridge username (user_id is a strict Link->User).
            fields=["name", "employee_name", "branch", "designation", "employee_number",
                    "user_id", "cell_number", "status"],
            order_by="employee_name", limit=200,
        )
        # NOTE: the Employee id is appended LAST so existing column indices (0-5)
        # stay stable for the table; the profile drawer reads row[6].
        return [[r.employee_name, r.branch or "", r.designation or "",
                 r.employee_number or r.user_id or "", r.cell_number or "", r.status,
                 r.name]
                for r in rows]

    return _cached(_cache_key("staff_list", branch), build)


# =============================================================================
# 10. student_list
# =============================================================================
@frappe.whitelist()
def student_list(branch=None):
    _require_hq()

    def build():
        students = frappe.get_all(
            "Student", filters=branch_filter(branch, "Student"),
            fields=_student_fields(["name", "student_name", "student_mobile_number", "enabled"]),
            order_by="student_name", limit=200,
        )
        out = []
        for s in students:
            program = frappe.db.get_value(
                "Program Enrollment", {"student": s.name}, "program",
                order_by="enrollment_date desc",
            ) or ""
            out.append([
                s.name,
                s.student_name,
                s.get("custom_branch") or "",
                program,
                s.student_mobile_number or "",
                "Active" if s.enabled else "Inactive",
            ])
        return out

    return _cached(_cache_key("student_list", branch), build)


# =============================================================================
# 11. fee_rows  (per-student: name, branch, class, pending, collected, total)
# =============================================================================
@frappe.whitelist()
def fee_rows(branch=None, limit=100):
    _require_hq()
    limit = int(limit)

    def build():
        students = frappe.get_all(
            "Student", filters=branch_filter(branch, "Student"),
            fields=_student_fields(["name", "student_name"]),
            order_by="student_name", limit=limit,
        )
        out = []
        for s in students:
            inv = frappe.db.sql(
                """
                select coalesce(sum(grand_total), 0)        as total,
                       coalesce(sum(outstanding_amount), 0) as pending
                from `tabSales Invoice`
                where docstatus = 1 and student = %s
                """,
                (s.name,), as_dict=True,
            )[0]
            total = flt(inv.total, 2)
            pending = flt(inv.pending, 2)
            program = frappe.db.get_value(
                "Program Enrollment", {"student": s.name}, "program",
                order_by="enrollment_date desc",
            ) or ""
            out.append([
                s.student_name,
                s.get("custom_branch") or "",
                program,
                pending,
                flt(total - pending, 2),
                total,
            ])
        return out

    return _cached(_cache_key("fee_rows", branch, str(limit)), build)


# =============================================================================
# 12. inventory_list  (ERPNext Item)
# =============================================================================
@frappe.whitelist()
def inventory_list():
    _require_hq()

    def build():
        rows = frappe.get_all(
            "Item", fields=["item_code", "item_name", "item_group", "disabled", "standard_rate"],
            order_by="creation", limit=200,
        )
        out = []
        for i, r in enumerate(rows, 1):
            out.append([
                str(i), r.item_name or r.item_code, r.item_group or "",
                "Inactive" if r.disabled else "Active",
                "{:,.2f}".format(flt(r.standard_rate)), "0",
            ])
        return out

    return _cached(_cache_key("inventory_list"), build)


# =============================================================================
# 13. invoice_list  (submitted Sales Invoice)
# =============================================================================
@frappe.whitelist()
def invoice_list(branch=None):
    _require_hq()

    def build():
        filters = [["docstatus", "=", 1]] + branch_filter(branch, "Sales Invoice")
        rows = frappe.get_all(
            "Sales Invoice", filters=filters,
            fields=["name", "posting_date", "grand_total", "outstanding_amount"],
            order_by="posting_date desc", limit=200,
        )
        out = []
        for i, r in enumerate(rows, 1):
            status = "Paid" if flt(r.outstanding_amount) <= 0 else "Unpaid"
            out.append([
                str(i), r.name,
                formatdate(r.posting_date, "d MMM yyyy") if r.posting_date else "",
                r.name, "{:,.2f}".format(flt(r.grand_total)), status,
            ])
        return out

    return _cached(_cache_key("invoice_list", branch), build)


# =============================================================================
# 14. billing_categories  (ERPNext Item Group)
# =============================================================================
@frappe.whitelist()
def billing_categories():
    _require_hq()

    def build():
        rows = frappe.get_all(
            "Item Group", fields=["item_group_name", "creation", "owner", "is_group"],
            order_by="creation desc", limit=100,
        )
        return [[
            r.item_group_name,
            formatdate(r.creation, "d MMM yyyy") if r.creation else "",
            (r.owner or "").split("@")[0] or "Admin",
            True,
        ] for r in rows]

    return _cached(_cache_key("billing_categories"), build)


# =============================================================================
# 15. curriculum_list  (Education Program — Course/Topic empty on this site)
# =============================================================================
@frappe.whitelist()
def curriculum_list():
    _require_hq()

    def build():
        rows = frappe.get_all(
            "Program", fields=["program_name", "program_abbreviation", "modified", "disabled"]
            if _has_field("Program", "disabled") else ["program_name", "program_abbreviation", "modified"],
            order_by="program_name", limit=100,
        )
        out = []
        for r in rows:
            status = "Inactive" if r.get("disabled") else "Active"
            d = formatdate(r.modified, "dd-MMM-yyyy") if r.modified else ""
            out.append([
                r.program_name, "—", "Academic", r.program_abbreviation or r.program_name,
                status, d, d,
            ])
        return out

    return _cached(_cache_key("curriculum_list"), build)


# =============================================================================
# 16. reports_list  (Frappe Report definitions for relevant modules)
# =============================================================================
@frappe.whitelist()
def reports_list():
    _require_hq()

    def build():
        rows = frappe.get_all(
            "Report",
            filters=[["module", "in", ["Education", "Selling", "Accounts", "HR", "Payroll", "Stock"]]],
            fields=["name", "module", "modified", "disabled"],
            order_by="modified desc", limit=25,
        )
        out = []
        for r in rows:
            d = formatdate(r.modified, "dd MMM yyyy") if r.modified else ""
            out.append([
                r.name, r.module or "", d, d,
                "Disabled" if r.disabled else "Completed",
            ])
        return out

    return _cached(_cache_key("reports_list"), build)


# =============================================================================
# 17. settings_info  (Company + system info, read-only)
# =============================================================================
@frappe.whitelist()
def settings_info():
    _require_hq()

    def build():
        co = frappe.get_all("Company", fields=["name", "email", "phone_no", "country"], limit=1)
        c = co[0] if co else {}
        return {
            "systemName": c.get("name") or "Rosemount International Preschool",
            "systemTitle": "Be Bold Be Strong Be Wise",
            "email": c.get("email") or "",
            "phone": c.get("phone_no") or "",
            "country": c.get("country") or "India",
            "branches": frappe.db.count("Branch"),
            "students": frappe.db.count("Student"),
            "staff": frappe.db.count("Employee"),
        }

    return _cached(_cache_key("settings_info"), build)


# =============================================================================
# Phase 1 — profiles, ledgers, calendar, student attendance
# =============================================================================
@frappe.whitelist()
def student_profile(student):
    """Everything the Students drawer shows: identity, guardians, enrolment,
    fee position and attendance rate."""
    _require_hq()

    def build():
        s = frappe.db.get_value(
            "Student", student,
            ["name", "student_name", "student_email_id", "student_mobile_number",
             "joining_date", "date_of_birth", "gender", "enabled"],
            as_dict=True,
        )
        if not s:
            frappe.throw("Student not found")
        s["branch"] = frappe.db.get_value("Student", student, "custom_branch") \
            if _has_field("Student", "custom_branch") else ""

        enr = frappe.get_all(
            "Program Enrollment", filters={"student": student, "docstatus": 1},
            fields=["name", "program", "academic_year", "enrollment_date"],
            order_by="enrollment_date desc",
        )
        guardians = frappe.get_all(
            "Student Guardian", filters={"parent": student},
            fields=["guardian", "guardian_name", "relation"],
        )
        for g in guardians:
            g["mobile"] = frappe.db.get_value("Guardian", g.guardian, "mobile_number") or ""
            g["email"] = frappe.db.get_value("Guardian", g.guardian, "email_address") or ""

        # fee position from submitted invoices
        inv = frappe.get_all(
            "Sales Invoice", filters={"student": student, "docstatus": 1},
            fields=["grand_total", "outstanding_amount"],
        ) if _has_field("Sales Invoice", "student") else []
        total = sum(flt(i.grand_total) for i in inv)
        pending = sum(flt(i.outstanding_amount) for i in inv)

        # attendance rate
        att = frappe.get_all("Student Attendance",
                             filters={"student": student, "docstatus": 1},
                             fields=["status"])
        present = len([a for a in att if a.status in ("Present", "Half Day")])
        rate = round((present / len(att)) * 100) if att else None

        return {
            "student": s,
            "enrollment": enr[0] if enr else None,
            "enrollmentHistory": enr,
            "guardians": guardians,
            "fees": {"total": total, "collected": total - pending, "pending": pending},
            "attendance": {"present": present, "total": len(att), "rate": rate},
        }

    return _cached(_cache_key("student_profile", None, student), build)


@frappe.whitelist()
def fee_ledger(student):
    """Per-student invoice + payment history for the fees drawer."""
    _require_hq()

    def build():
        if not _has_field("Sales Invoice", "student"):
            return {"invoices": [], "payments": []}
        invoices = frappe.get_all(
            "Sales Invoice", filters={"student": student, "docstatus": 1},
            fields=["name", "posting_date", "grand_total", "outstanding_amount", "status"],
            order_by="posting_date desc",
        )
        rows = [[
            i.name, formatdate(i.posting_date, "d MMM yyyy"), flt(i.grand_total),
            flt(i.grand_total) - flt(i.outstanding_amount), flt(i.outstanding_amount),
            "Paid" if flt(i.outstanding_amount) <= 0 else
            ("Partial" if flt(i.outstanding_amount) < flt(i.grand_total) else "Unpaid"),
        ] for i in invoices]

        payments = []
        names = [i.name for i in invoices]
        if names:
            per = frappe.get_all(
                "Payment Entry Reference",
                filters=[["reference_name", "in", names], ["docstatus", "=", 1]],
                fields=["parent", "reference_name", "allocated_amount"],
            )
            for p in per:
                pe = frappe.db.get_value("Payment Entry", p.parent,
                                         ["posting_date", "mode_of_payment"], as_dict=True) or {}
                payments.append([
                    p.parent,
                    formatdate(pe.get("posting_date"), "d MMM yyyy") if pe.get("posting_date") else "",
                    pe.get("mode_of_payment") or "—",
                    p.reference_name, flt(p.allocated_amount),
                ])
        return {"invoices": rows, "payments": payments}

    return _cached(_cache_key("fee_ledger", None, student), build)


@frappe.whitelist()
def staff_profile(employee):
    """Employee detail for the Staff drawer."""
    _require_hq()

    def build():
        e = frappe.db.get_value(
            "Employee", employee,
            ["name", "employee_name", "designation", "department", "branch", "status",
             "date_of_joining", "cell_number", "personal_email", "company_email",
             "employee_number", "gender"],
            as_dict=True,
        )
        if not e:
            frappe.throw("Employee not found")
        att = frappe.get_all("Attendance",
                             filters={"employee": employee, "docstatus": 1},
                             fields=["status"])
        present = len([a for a in att if a.status in ("Present", "Work From Home", "Half Day")])
        e["attendanceRate"] = round((present / len(att)) * 100) if att else None
        e["leaves"] = frappe.db.count("Leave Application",
                                      {"employee": employee, "docstatus": 1})
        return e

    return _cached(_cache_key("staff_profile", None, employee), build)


@frappe.whitelist()
def upcoming_events(limit=8):
    """Next entries from the company's annual calendar (Holiday List)."""
    _require_hq()
    limit = int(limit)

    def build():
        hl = frappe.db.get_value("Company", _default_company(), "default_holiday_list")
        if not hl:
            hl = frappe.db.get_value("Holiday List", {}, "name")
        if not hl:
            return []
        rows = frappe.get_all(
            "Holiday", filters=[["parent", "=", hl], ["holiday_date", ">=", nowdate()]],
            fields=["holiday_date", "description", "weekly_off"],
            order_by="holiday_date asc", limit=limit,
        )
        out = []
        for r in rows:
            desc = frappe.utils.strip_html(r.description or "").strip()
            # anything that isn't a public holiday reads as a school event
            kind = "HOLIDAY" if not _is_event(desc) else "EVENT"
            out.append([kind, desc, formatdate(r.holiday_date, "d MMM yyyy"), str(r.holiday_date)])
        return out

    return _cached(_cache_key("upcoming_events", None, str(limit)), build)


def _is_event(desc):
    d = (desc or "").lower()
    return any(k in d for k in ("day function", "sports", "meeting", "ptm", "annual day", "exam"))


def _default_company():
    return frappe.defaults.get_user_default("Company") or frappe.db.get_value("Company", {}, "name")


@frappe.whitelist()
def student_attendance_today(branch=None):
    """Student (not staff) attendance for the most recent marked day."""
    _require_hq()

    def build():
        last = frappe.db.sql(
            "SELECT MAX(`date`) FROM `tabStudent Attendance` WHERE docstatus = 1")
        day = last[0][0] if last and last[0] else None
        if not day:
            return {"present": 0, "absent": 0, "total": 0, "rate": 0, "date": None}
        rows = frappe.get_all("Student Attendance",
                              filters={"date": day, "docstatus": 1},
                              fields=["student", "status"])
        if branch and _has_field("Student", "custom_branch"):
            allowed = {s.name for s in frappe.get_all(
                "Student", filters={"custom_branch": branch}, fields=["name"])}
            rows = [r for r in rows if r.student in allowed]
        present = len([r for r in rows if r.status in ("Present", "Half Day")])
        total = len(rows)
        return {
            "present": present, "absent": total - present, "total": total,
            "rate": round((present / total) * 100) if total else 0,
            "date": formatdate(day, "d MMM yyyy"),
        }

    return _cached(_cache_key("student_attendance_today", branch), build)


@frappe.whitelist()
def student_attendance_rows(branch=None, date=None, limit=200):
    """Attendance register: one row per student for a given day (default latest)."""
    _require_hq()
    limit = int(limit)

    def build():
        day = date
        if not day:
            last = frappe.db.sql(
                "SELECT MAX(`date`) FROM `tabStudent Attendance` WHERE docstatus = 1")
            day = last[0][0] if last and last[0] else None
        if not day:
            return {"date": None, "rows": []}
        rows = frappe.get_all(
            "Student Attendance", filters={"date": day, "docstatus": 1},
            fields=["student", "student_name", "student_group", "status"],
            order_by="student_name", limit=limit,
        )
        out = []
        for r in rows:
            br = frappe.db.get_value("Student", r.student, "custom_branch") \
                if _has_field("Student", "custom_branch") else ""
            if branch and br != branch:
                continue
            out.append([r.student, r.student_name, br or "",
                        (r.student_group or "").replace(" 2026-2027", ""), r.status])
        return {"date": formatdate(day, "d MMM yyyy"), "rows": out}

    return _cached(_cache_key("student_attendance_rows", branch, str(date or "latest")), build)


@frappe.whitelist()
def attendance_trend(branch=None, days=10):
    """Daily student attendance rate for the last N marked school days."""
    _require_hq()
    days = int(days)

    def build():
        marked = frappe.db.sql(
            "SELECT DISTINCT `date` FROM `tabStudent Attendance` "
            "WHERE docstatus = 1 ORDER BY `date` DESC LIMIT %s", (days,))
        out = []
        allowed = None
        if branch and _has_field("Student", "custom_branch"):
            allowed = {s.name for s in frappe.get_all(
                "Student", filters={"custom_branch": branch}, fields=["name"])}
        for (day,) in reversed(marked or []):
            rows = frappe.get_all("Student Attendance",
                                  filters={"date": day, "docstatus": 1},
                                  fields=["student", "status"])
            if allowed is not None:
                rows = [r for r in rows if r.student in allowed]
            total = len(rows)
            present = len([r for r in rows if r.status in ("Present", "Half Day")])
            out.append({
                "d": formatdate(day, "d MMM"),
                "rate": round((present / total) * 100) if total else 0,
                "present": present, "absent": total - present,
            })
        return out

    return _cached(_cache_key("attendance_trend", branch, str(days)), build)


# =============================================================================
# WRITE operations (create / edit / delete) — HQ-guarded, allowlisted
# =============================================================================
def _bust():
    try:
        frappe.cache().delete_keys("rmd::")
    except Exception:
        pass


@frappe.whitelist()
def add_branch(name, code="", email="", phone="", status="Active"):
    _require_hq()
    if frappe.db.exists("Branch", name):
        frappe.throw("A branch named '%s' already exists." % name)
    frappe.get_doc({
        "doctype": "Branch", "branch": name, "custom_branch_code": code,
        "custom_email": email, "custom_phone": phone, "custom_status": status or "Active",
    }).insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": name}


@frappe.whitelist()
def add_staff(name, branch="", designation="Teacher", phone="", username=""):
    _require_hq()
    from . import seed
    designation = designation or "Teacher"
    seed._ensure_designation(designation)
    parts = (name or "").split(" ", 1)
    doc = frappe.get_doc({
        "doctype": "Employee", "first_name": parts[0],
        "last_name": parts[1] if len(parts) > 1 else "", "employee_name": name,
        "gender": seed._a_gender(), "date_of_birth": "1990-01-01", "date_of_joining": "2024-06-01",
        "company": seed._company(), "branch": branch or None, "designation": designation,
        "employee_number": username or None, "cell_number": phone, "status": "Active",
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": doc.name}


@frappe.whitelist()
def add_student(name, branch="", program="", mobile=""):
    _require_hq()
    import re
    from . import seed
    frappe.db.set_single_value("Education Settings", "user_creation_skip", 1)
    cgroup = seed._pick("Customer Group", ["Individual", "Commercial", "All Customer Groups"])
    territory = seed._pick("Territory", ["India", "All Territories"])
    if program:
        seed._ensure_program(program)
    parts = (name or "").split(" ", 1)
    slug = re.sub(r"[^a-z0-9]+", ".", (name or "").lower()).strip(".")
    cust = seed._ensure_customer(name, cgroup, territory)
    doc = frappe.get_doc({
        "doctype": "Student", "first_name": parts[0],
        "last_name": parts[1] if len(parts) > 1 else "",
        "student_email_id": "%s@students.rosemount.local" % slug,
        "student_mobile_number": mobile, "joining_date": "2026-04-01",
        "enabled": 1, "customer": cust, "custom_branch": branch or None,
    })
    doc.insert(ignore_permissions=True)
    if program:
        pe = frappe.get_doc({
            "doctype": "Program Enrollment", "student": doc.name, "program": program,
            "academic_year": "2026-2027", "enrollment_date": "2026-04-01",
            "custom_branch": branch or None,
        })
        pe.insert(ignore_permissions=True)
        pe.submit()
    frappe.db.commit(); _bust()
    return {"ok": True, "name": doc.name}


@frappe.whitelist()
def add_product(name, item_group="Products", rate=0):
    _require_hq()
    from . import seed
    if frappe.db.exists("Item", name):
        frappe.throw("An item named '%s' already exists." % name)
    grp = item_group if (frappe.db.exists("Item Group", item_group)
                         and not frappe.db.get_value("Item Group", item_group, "is_group")) \
        else seed._pick("Item Group", ["Products", "Services", "All Item Groups"])
    frappe.get_doc({
        "doctype": "Item", "item_code": name, "item_name": name, "item_group": grp,
        "stock_uom": "Nos", "gst_hsn_code": seed._an_hsn(), "is_stock_item": 0,
        "is_sales_item": 1, "standard_rate": flt(rate),
    }).insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": name}


@frappe.whitelist()
def add_category(name):
    _require_hq()
    if frappe.db.exists("Item Group", name):
        frappe.throw("A category named '%s' already exists." % name)
    frappe.get_doc({
        "doctype": "Item Group", "item_group_name": name,
        "parent_item_group": "All Item Groups", "is_group": 0,
    }).insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": name}


_EDITABLE = {
    "Branch": {"custom_email", "custom_phone", "custom_status"},
    "Item": {"standard_rate", "disabled"},
    "Employee": {"cell_number", "designation", "status"},
    "Student": {"student_mobile_number", "enabled"},
    "Student Applicant": {"application_status", "custom_source"},
}


@frappe.whitelist()
def update_doc(doctype, name, values):
    _require_hq()
    import json
    vals = json.loads(values) if isinstance(values, str) else (values or {})
    allowed = _EDITABLE.get(doctype, set())
    clean = {k: v for k, v in vals.items() if k in allowed}
    if not clean:
        frappe.throw("No editable fields supplied.")
    if not frappe.db.exists(doctype, name):
        frappe.throw("%s '%s' not found." % (doctype, name))
    frappe.db.set_value(doctype, name, clean)
    frappe.db.commit(); _bust()
    return {"ok": True}


@frappe.whitelist()
def remove_doc(doctype, name):
    _require_hq()
    if doctype not in {"Branch", "Employee", "Student", "Item", "Item Group",
                       "Academic Year", "Program", "Holiday List", "Student Applicant",
                       "Course", "Topic"}:
        frappe.throw("Deleting %s is not permitted from the dashboard." % doctype)
    try:
        frappe.delete_doc(doctype, name, ignore_permissions=True)
    except frappe.LinkExistsError:
        frappe.throw("Can't delete '%s' — it's still linked to other records." % name)
    frappe.db.commit(); _bust()
    return {"ok": True}


@frappe.whitelist()
def save_settings(values):
    _require_hq()
    import json
    vals = json.loads(values) if isinstance(values, str) else (values or {})
    co = frappe.get_all("Company", limit=1)
    if not co:
        return {"ok": False}
    upd = {}
    if vals.get("email"):
        upd["email"] = vals["email"]
    if vals.get("phone"):
        upd["phone_no"] = vals["phone"]
    if upd:
        frappe.db.set_value("Company", co[0].name, upd)
        frappe.db.commit(); _bust()
    return {"ok": True}


@frappe.whitelist()
def send_broadcast(channel="", audience="", message=""):
    _require_hq()
    if not message:
        frappe.throw("Message is required.")
    note = frappe.get_doc({
        "doctype": "Note",
        "title": "Broadcast · %s → %s" % (channel or "—", audience or "All"),
        "content": message, "public": 1,
    })
    note.insert(ignore_permissions=True)
    frappe.db.commit()
    # NOTE: this records the broadcast; actual SMS/WhatsApp/email delivery needs a
    # configured gateway (Twilio / SMS Settings) which is not provisioned here.
    return {"ok": True, "name": note.name}


# =============================================================================
# ACADEMIC SETUP — Academic Years, Programs/Classes, Holiday Calendar
# =============================================================================
@frappe.whitelist()
def academic_years():
    _require_hq()

    def build():
        rows = frappe.get_all("Academic Year",
            fields=["name", "year_start_date", "year_end_date"], order_by="year_start_date desc")
        out = []
        for r in rows:
            cur = (r.year_start_date and r.year_end_date
                   and getdate(r.year_start_date) <= getdate(nowdate()) <= getdate(r.year_end_date))
            out.append([
                r.name,
                formatdate(r.year_start_date, "d MMM yyyy") if r.year_start_date else "",
                formatdate(r.year_end_date, "d MMM yyyy") if r.year_end_date else "",
                "Current" if cur else "—",
            ])
        return out

    return _cached(_cache_key("academic_years"), build)


@frappe.whitelist()
def programs_list():
    _require_hq()

    def build():
        rows = frappe.get_all("Program", fields=["name", "program_abbreviation"], order_by="name")
        return [[r.name, r.program_abbreviation or "—",
                 frappe.db.count("Program Enrollment", {"program": r.name})] for r in rows]

    return _cached(_cache_key("programs_list"), build)


@frappe.whitelist()
def holiday_lists():
    _require_hq()

    def build():
        rows = frappe.get_all("Holiday List",
            fields=["name", "from_date", "to_date", "total_holidays"], order_by="from_date desc")
        return [[r.name,
                 formatdate(r.from_date, "d MMM yyyy") if r.from_date else "",
                 formatdate(r.to_date, "d MMM yyyy") if r.to_date else "",
                 r.total_holidays or 0] for r in rows]

    return _cached(_cache_key("holiday_lists"), build)


@frappe.whitelist()
def add_academic_year(name, start, end):
    _require_hq()
    if frappe.db.exists("Academic Year", name):
        frappe.throw("Academic Year '%s' already exists." % name)
    frappe.get_doc({
        "doctype": "Academic Year", "academic_year_name": name,
        "year_start_date": start or None, "year_end_date": end or None,
    }).insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": name}


@frappe.whitelist()
def add_program(name, abbr=""):
    _require_hq()
    if frappe.db.exists("Program", name):
        frappe.throw("Program '%s' already exists." % name)
    frappe.get_doc({
        "doctype": "Program", "program_name": name,
        "program_abbreviation": abbr or name[:10],
    }).insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": name}


@frappe.whitelist()
def add_holiday_list(name, from_date, to_date):
    _require_hq()
    doc = frappe.get_doc({
        "doctype": "Holiday List", "holiday_list_name": name,
        "from_date": from_date, "to_date": to_date,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": doc.name}


# =============================================================================
# FEES DEPTH — structures, receipts, payment verification, fee collection
# =============================================================================
@frappe.whitelist()
def fee_structures():
    _require_hq()

    def build():
        if not frappe.db.exists("DocType", "Fee Structure"):
            return []
        rows = frappe.get_all("Fee Structure",
            fields=["name", "program", "academic_year", "total_amount"],
            order_by="creation desc", limit=100)
        return [[r.name, r.program or "—", r.academic_year or "—",
                 "{:,.2f}".format(flt(r.total_amount))] for r in rows]

    return _cached(_cache_key("fee_structures"), build)


@frappe.whitelist()
def receipts(branch=None):
    _require_hq()

    def build():
        rows = frappe.get_all("Payment Entry",
            filters=[["docstatus", "=", 1], ["payment_type", "=", "Receive"]],
            fields=["name", "party_name", "posting_date", "paid_amount",
                    "mode_of_payment", "reference_no"],
            order_by="posting_date desc", limit=200)
        return [[r.name, r.party_name or "",
                 formatdate(r.posting_date, "d MMM yyyy") if r.posting_date else "",
                 "{:,.2f}".format(flt(r.paid_amount)), r.mode_of_payment or "—",
                 r.reference_no or "—"] for r in rows]

    return _cached(_cache_key("receipts"), build)


@frappe.whitelist()
def outstanding_invoices(branch=None):
    _require_hq()

    def build():
        filters = [["docstatus", "=", 1], ["outstanding_amount", ">", 0]] \
            + branch_filter(branch, "Sales Invoice")
        rows = frappe.get_all("Sales Invoice", filters=filters,
            fields=["name", "student", "custom_branch", "grand_total",
                    "outstanding_amount", "posting_date"],
            order_by="posting_date desc", limit=200)
        out = []
        for r in rows:
            sname = frappe.db.get_value("Student", r.student, "student_name") if r.student else ""
            out.append([
                r.name, sname or r.student or "", r.custom_branch or "",
                "{:,.2f}".format(flt(r.grand_total)),
                "{:,.2f}".format(flt(r.outstanding_amount)),
                formatdate(r.posting_date, "d MMM yyyy") if r.posting_date else "",
            ])
        return out

    return _cached(_cache_key("outstanding_invoices", branch), build)


@frappe.whitelist()
def record_payment(invoice, amount=None, mode=None):
    """Create + submit a Payment Entry against a Sales Invoice (= collect fees)."""
    _require_hq()
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
    si = frappe.get_doc("Sales Invoice", invoice)
    if si.docstatus != 1:
        frappe.throw("Invoice is not submitted.")
    outstanding = flt(si.outstanding_amount)
    amt = flt(amount) if amount else outstanding
    if amt <= 0:
        frappe.throw("Nothing outstanding on this invoice.")
    if amt > outstanding:
        amt = outstanding
    pe = get_payment_entry("Sales Invoice", invoice)
    pe.paid_to = frappe.db.get_value("Company", si.company, "default_cash_account")
    pe.reference_no = "RCPT-%s" % invoice
    pe.reference_date = nowdate()
    pe.posting_date = nowdate()
    for r in pe.references:
        r.allocated_amount = amt
    pe.paid_amount = amt
    pe.received_amount = amt
    pe.insert(ignore_permissions=True)
    pe.submit()
    frappe.db.commit(); _bust()
    return {"ok": True, "name": pe.name, "amount": amt}


# =============================================================================
# ENQUIRY / LEAD CRM — student-admission enquiry pipeline (Student Applicant)
# =============================================================================
@frappe.whitelist()
def enquiry_list(branch=None):
    _require_hq()

    def build():
        has_src = _has_field("Student Applicant", "custom_source")
        fields = ["name", "first_name", "last_name", "application_status",
                  "program", "creation"]
        if _has_field("Student Applicant", "custom_branch"):
            fields.append("custom_branch")
        if has_src:
            fields.append("custom_source")
        rows = frappe.get_all("Student Applicant",
            filters=branch_filter(branch, "Student Applicant"),
            fields=fields, order_by="creation desc", limit=200)
        out = []
        for r in rows:
            nm = (" ".join([x for x in [r.get("first_name"), r.get("last_name")] if x])).strip() or r.name
            out.append([
                r.name, nm, r.get("custom_branch") or "", r.get("program") or "",
                r.get("custom_source") or "—", r.get("application_status") or "Applied",
                formatdate(r.creation, "d MMM yyyy") if r.creation else "",
            ])
        return out

    return _cached(_cache_key("enquiry_list", branch), build)


@frappe.whitelist()
def add_enquiry(name, branch="", program="", source="", mobile=""):
    _require_hq()
    parts = (name or "").split(" ", 1)
    doc = {
        "doctype": "Student Applicant", "first_name": parts[0],
        "last_name": parts[1] if len(parts) > 1 else "",
        "application_status": "Applied", "custom_branch": branch or None,
    }
    if program:
        doc["program"] = program
        doc["academic_year"] = _current_academic_year()
    if _has_field("Student Applicant", "custom_source") and source:
        doc["custom_source"] = source
    if mobile and _has_field("Student Applicant", "student_mobile_number"):
        doc["student_mobile_number"] = mobile
    d = frappe.get_doc(doc)
    d.insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": d.name}


# =============================================================================
# INVENTORY / KIT-ORDERING WORKFLOW — request → accept → dispatch → track
# =============================================================================
_KIT_STATUS = {"Pending", "Accepted", "Dispatched", "Completed", "Rejected"}


@frappe.whitelist()
def kit_order_list(branch=None):
    _require_hq()

    def build():
        has_status = _has_field("Sales Order", "custom_kit_status")
        fields = ["name", "po_no", "order_type", "transaction_date", "grand_total",
                  "advance_payment_status", "per_billed"]
        if _has_field("Sales Order", "custom_branch"):
            fields.append("custom_branch")
        if has_status:
            fields.append("custom_kit_status")
        filters = [["docstatus", "=", 1]]
        if _has_field("Sales Order", "custom_branch"):
            filters.append(["custom_branch", "is", "set"])
        filters += branch_filter(branch, "Sales Order")
        orders = frappe.get_all("Sales Order", filters=filters, fields=fields,
            order_by="transaction_date desc", limit=200)
        out = []
        for so in orders:
            item = frappe.db.get_value("Sales Order Item", {"parent": so.name}, "item_name") or ""
            paid = (so.advance_payment_status == "Fully Paid") or (flt(so.per_billed) >= 100)
            amount = fmt_money(flt(so.grand_total), precision=0, currency="INR")
            amount = amount.replace("₹", "").replace("INR", "").strip()
            out.append([
                so.po_no or so.name, item, so.get("custom_branch") or "",
                "Product", "Success" if paid else "Pending", amount,
                formatdate(so.transaction_date, "d MMM yyyy") if so.transaction_date else "",
                so.get("custom_kit_status") or "Pending",
                so.name,  # internal id for actions
            ])
        return out

    return _cached(_cache_key("kit_order_list", branch), build)


@frappe.whitelist()
def set_kit_status(order, status):
    _require_hq()
    if status not in _KIT_STATUS:
        frappe.throw("Invalid status.")
    if not frappe.db.exists("Sales Order", order):
        frappe.throw("Order not found.")
    frappe.db.set_value("Sales Order", order, "custom_kit_status", status)
    frappe.db.commit(); _bust()
    return {"ok": True}


@frappe.whitelist()
def add_kit_order(branch, item, qty=1, rate=0):
    _require_hq()
    from . import seed
    cgroup = seed._pick("Customer Group", ["Individual", "Commercial", "All Customer Groups"])
    territory = seed._pick("Territory", ["India", "All Territories"])
    grp = seed._pick("Item Group", ["Products", "Services", "All Item Groups"])
    seed._ensure_item(item, grp, "Nos")
    cust = seed._ensure_customer(branch, cgroup, territory)
    cc = frappe.db.get_value("Company", seed._company(), "cost_center")
    so = frappe.get_doc({
        "doctype": "Sales Order", "customer": cust, "company": seed._company(),
        "transaction_date": nowdate(), "delivery_date": nowdate(),
        "custom_branch": branch, "order_type": "Sales", "cost_center": cc,
        "items": [{"item_code": item, "qty": flt(qty) or 1, "rate": flt(rate),
                   "delivery_date": nowdate(), "cost_center": cc}],
    })
    if _has_field("Sales Order", "custom_kit_status"):
        so.custom_kit_status = "Pending"
    so.insert(ignore_permissions=True)
    so.submit()
    frappe.db.commit(); _bust()
    return {"ok": True, "name": so.name}


# =============================================================================
# HRMS SURFACE — read-only views of the installed HRMS app (leave/payroll
# processing happens in the HR app; the dashboard surfaces the data)
# =============================================================================
@frappe.whitelist()
def hr_employees(branch=None):
    _require_hq()

    def build():
        rows = frappe.get_all("Employee", filters=branch_filter(branch, "Employee"),
            fields=["employee_name", "designation", "department", "date_of_joining", "status", "branch"],
            order_by="employee_name", limit=200)
        return [[r.employee_name, r.designation or "—", r.department or "—",
                 formatdate(r.date_of_joining, "d MMM yyyy") if r.date_of_joining else "—",
                 r.status, r.branch or ""] for r in rows]

    return _cached(_cache_key("hr_employees", branch), build)


@frappe.whitelist()
def leave_applications(branch=None):
    _require_hq()

    def build():
        if not frappe.db.exists("DocType", "Leave Application"):
            return []
        rows = frappe.get_all("Leave Application",
            fields=["employee_name", "leave_type", "from_date", "to_date", "total_leave_days", "status"],
            order_by="from_date desc", limit=200)
        return [[r.employee_name or "", r.leave_type or "",
                 formatdate(r.from_date, "d MMM yyyy") if r.from_date else "",
                 formatdate(r.to_date, "d MMM yyyy") if r.to_date else "",
                 r.total_leave_days or 0, r.status or "Open"] for r in rows]

    return _cached(_cache_key("leave_applications", branch), build)


@frappe.whitelist()
def salary_slips():
    _require_hq()

    def build():
        if not frappe.db.exists("DocType", "Salary Slip"):
            return []
        rows = frappe.get_all("Salary Slip",
            fields=["employee_name", "start_date", "end_date", "gross_pay", "net_pay", "status"],
            order_by="start_date desc", limit=200)
        out = []
        for r in rows:
            period = ""
            if r.start_date:
                period = formatdate(r.start_date, "MMM yyyy")
            out.append([r.employee_name or "", period,
                        "{:,.2f}".format(flt(r.gross_pay)), "{:,.2f}".format(flt(r.net_pay)),
                        r.status or "Draft"])
        return out

    return _cached(_cache_key("salary_slips"), build)


@frappe.whitelist()
def departments_list():
    _require_hq()

    def build():
        rows = frappe.get_all("Department", filters={"is_group": 0},
            fields=["name", "department_name", "parent_department"], order_by="name", limit=100)
        return [[r.department_name or r.name, r.parent_department or "—",
                 frappe.db.count("Employee", {"department": r.name})] for r in rows]

    return _cached(_cache_key("departments_list"), build)


# =============================================================================
# CURRICULUM — courses (subjects) + topics (lessons), Education doctypes
# =============================================================================
@frappe.whitelist()
def courses_list():
    _require_hq()

    def build():
        if not frappe.db.exists("DocType", "Course"):
            return []
        rows = frappe.get_all("Course", fields=["name", "course_name"],
                              order_by="course_name", limit=200)
        return [[r.name, r.course_name or r.name, "Published"] for r in rows]

    return _cached(_cache_key("courses_list"), build)


@frappe.whitelist()
def topics_list():
    _require_hq()

    def build():
        if not frappe.db.exists("DocType", "Topic"):
            return []
        rows = frappe.get_all("Topic", fields=["name", "topic_name"],
                              order_by="creation", limit=200)
        return [[r.name, r.topic_name or r.name] for r in rows]

    return _cached(_cache_key("topics_list"), build)


@frappe.whitelist()
def add_course(name):
    _require_hq()
    if frappe.db.exists("Course", {"course_name": name}):
        frappe.throw("Course '%s' already exists." % name)
    d = frappe.get_doc({"doctype": "Course", "course_name": name})
    d.insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": d.name}


@frappe.whitelist()
def add_topic(name):
    _require_hq()
    if frappe.db.exists("Topic", {"topic_name": name}):
        frappe.throw("Topic '%s' already exists." % name)
    d = frappe.get_doc({"doctype": "Topic", "topic_name": name})
    d.insert(ignore_permissions=True)
    frappe.db.commit(); _bust()
    return {"ok": True, "name": d.name}


# =============================================================================
# RBAC — who can access the HQ dashboard (grant/revoke the HQ Dashboard role)
# =============================================================================
@frappe.whitelist()
def hq_users():
    _require_hq()

    def build():
        names = frappe.get_all("Has Role", filters={"role": "HQ Dashboard"},
                               fields=["parent"], distinct=True)
        out = []
        for n in names:
            if n.parent in ("Guest", "Administrator"):
                continue
            u = frappe.db.get_value("User", n.parent, ["full_name", "enabled"], as_dict=True)
            if u:
                out.append([n.parent, u.full_name or "", "Enabled" if u.enabled else "Disabled"])
        return out

    return _cached(_cache_key("hq_users"), build)


@frappe.whitelist()
def grant_hq(email):
    _require_hq()
    if not frappe.db.exists("User", email):
        frappe.throw("No user with email '%s'. Create the user in Frappe first." % email)
    frappe.get_doc("User", email).add_roles("HQ Dashboard")
    frappe.db.commit(); _bust()
    return {"ok": True}


@frappe.whitelist()
def revoke_hq(email):
    _require_hq()
    if email == frappe.session.user:
        frappe.throw("You can't revoke your own access.")
    frappe.get_doc("User", email).remove_roles("HQ Dashboard")
    frappe.db.commit(); _bust()
    return {"ok": True}
