# Copyright (c) 2026, Rosemount International Preschool and contributors
"""Seed REAL Rosemount data (from the SchoolBridge dashboard source files).

Idempotent and defensive: re-running skips existing records and reports a
summary. Run with:

    bench --site rosemount execute rosemount_dashboard.seed.run

NOTE: only real, named records from the source files are created. Aggregate
screenshot totals (1,860 students, 412 staff, etc.) are larger than the named
rows available — load the full SchoolBridge export via rosemount_dashboard.importer
to reach them.
"""

import re

import frappe
from frappe.utils import getdate

COMPANY = None  # resolved at runtime

# ---- real data lifted verbatim from rosemount-erp.jsx / rosemount-frappe-data.js ----

# id, name, email, phone, status
BRANCHES = [
    ("RMKA0024", "RMIPS Horamavu", "rmka0024@rosemountedu.com", "7676576390", "Active"),
    ("RMKA0025", "RMIPS R T Nagar", "rosemountrtn@gmail.com", "6360380066", "Active"),
    ("RMKA0023", "RMIPS Rajaji Nagar", "rmka0023@rosemountedu.in", "8105034866", "Active"),
    ("RMKA0004", "RMIPS Singasandra", "rmka0004@rosemountedu.in", "9964271445", "Active"),
    ("RMKA0020", "RMIPS Gottigere", "rmka0020@rosemountedu.in", "9741656969", "Active"),
    ("RMKA0021", "RMIPS Uttarahalli", "rmka0021@rosemountedu.in", "9886051022", "Active"),
    ("RMKA0015", "RMIPS Hennur Bande", "rmka0015@rosemountedu.in", "8073577131", "Active"),
    ("RMKA0014", "RMIPS Kalkere", "rmka0014@rosemountedu.in", "9845311622", "Inactive"),
]
# branches referenced elsewhere in the data (no email/phone in source -> blank)
EXTRA_BRANCHES = [
    "RMIPS Serilingampally", "RMIPS Vijaya Bank", "RMIPS Hosapete", "RMIPS Carmelaram",
    "RMIPS Kundalahalli", "RMIPS Vignan Nagar", "RMIPS Chamarajnagar",
    "RMIPS Kadugodi", "RMIPS Kodigehalli",
]

# name, branch, designation, username, phone, status
STAFF = [
    ("A Sujatha", "RMIPS Serilingampally", "Teacher", "00ta4403", "7032979802", "Active"),
    ("A. Janaki", "RMIPS Vijaya Bank", "Cleaning Staff", "0046tajan", "9036694465", "Active"),
    ("Afreen Sheikh", "RMIPS Hosapete", "Teacher", "0041tafre", "8971903606", "Active"),
    ("AJITHA NAVAS", "RMIPS Carmelaram", "Non Teaching", "0049tajit5", "8971962943", "Active"),
    ("Alisha Shaik", "RMIPS Singasandra", "Teacher", "rmsgtalis", "9912525614", "Active"),
    ("Amrita D Kamble", "RMIPS Horamavu", "Teacher", "rmhatamr", "8296642146", "Active"),
]

# name, branch, class, mobile
STUDENTS = [
    ("Liyansh M", "RMIPS Kundalahalli", "Playgroup", "7373213363"),
    ("A.N. Tanesh", "RMIPS Rajaji Nagar", "Nursery", "8608481032"),
    ("Aabir Datta", "RMIPS Horamavu", "Nursery", "7278537888"),
    ("Aadhya Hulam", "RMIPS Rajaji Nagar", "KG 2", "9743348135"),
    ("Aadhya Kulk", "RMIPS Kalkere", "Nursery", "9738400293"),
    ("Aadhya Nair", "RMIPS Kundalahalli", "KG 2", "8088483744"),
    ("Aadhya.S", "RMIPS Rajaji Nagar", "KG 2", ""),
    ("Aadrika Shar", "RMIPS Gottigere", "Nursery", ""),
]

# name -> (branch, class, pending, collected, total); posting month index 0..5 (Jan..Jun 2026)
FEE_ROWS = [
    ("A.N. Tanesh", "RMIPS Rajaji Nagar", "Nursery", 47000, 5000, 52000, 0),
    ("Aabir Datta", "RMIPS Horamavu", "Nursery", 40000, 20000, 60000, 1),
    ("Aadhya Hulam", "RMIPS Rajaji Nagar", "KG 2", 44000, 10000, 54000, 2),
    ("Aadhya Kulk", "RMIPS Kalkere", "Nursery", 52000, 0, 52000, 3),
    ("Aadhya.S", "RMIPS Rajaji Nagar", "KG 2", 53000, 3000, 56000, 4),
    ("Aadrika Shar", "RMIPS Gottigere", "Nursery", 50000, 24000, 74000, 5),
]
FEE_MONTHS = ["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15", "2026-06-03"]

# order id, kit, branch, amount, date  (the three Pending orders)
KIT_ORDERS = [
    ("6514", "Premium Kit · Play Group", "RMIPS Vignan Nagar", 20800, "2026-06-03"),
    ("6510", "Standard Kit · Nursery", "RMIPS Rajaji Nagar", 14100, "2026-06-03"),
    ("6471", "Standard Kit · KG 2", "RMIPS Chamarajnagar", 80000, "2026-06-03"),
]


# =============================================================================
# helpers
# =============================================================================
LOG = []


def _log(msg):
    LOG.append(msg)


def _company():
    global COMPANY
    if not COMPANY:
        COMPANY = frappe.get_all("Company", limit=1)[0].name
    return COMPANY


def _pick(doctype, names, is_group_field="is_group"):
    for n in names:
        if frappe.db.exists(doctype, n):
            if is_group_field and frappe.db.get_value(doctype, n, is_group_field):
                continue
            return n
    leaf = frappe.get_all(doctype, filters={is_group_field: 0} if is_group_field else {}, limit=1)
    return leaf[0].name if leaf else (names[0] if names else None)


def _a_gender():
    for g in ("Other", "Prefer not to say", "Female", "Male"):
        if frappe.db.exists("Gender", g):
            return g
    gg = frappe.get_all("Gender", limit=1)
    return gg[0].name if gg else "Female"


def _ensure_designation(name):
    if not frappe.db.exists("Designation", name):
        frappe.get_doc({"doctype": "Designation", "designation_name": name}).insert(ignore_permissions=True)


def _ensure_program(name):
    if not frappe.db.exists("Program", name):
        frappe.get_doc({"doctype": "Program", "program_name": name,
                        "program_abbreviation": name[:10]}).insert(ignore_permissions=True)


_HSN = None


def _an_hsn():
    """A valid HSN/SAC code (india_compliance makes it mandatory on Items).

    Returns None when the GST HSN Code doctype isn't installed (e.g. a
    preschool site without india_compliance) so item creation can skip it.
    """
    global _HSN
    if _HSN:
        return _HSN
    if not frappe.db.exists("DocType", "GST HSN Code"):
        return None
    for code in ("999293", "999294", "999900"):  # 999293 = education/coaching services
        if frappe.db.exists("GST HSN Code", code):
            _HSN = code
            return _HSN
    row = frappe.get_all("GST HSN Code", filters=[["hsn_code", "like", "99%"]], limit=1)
    _HSN = row[0].name if row else frappe.get_all("GST HSN Code", limit=1)[0].name
    return _HSN


def _ensure_item(code, group, uom):
    if not frappe.db.exists("Item", code):
        doc = {
            "doctype": "Item", "item_code": code, "item_name": code,
            "item_group": group, "stock_uom": uom,
            "is_stock_item": 0, "is_sales_item": 1, "is_purchase_item": 0,
        }
        hsn = _an_hsn()
        if hsn:
            doc["gst_hsn_code"] = hsn
        frappe.get_doc(doc).insert(ignore_permissions=True)


def _ensure_customer(name, cgroup, territory):
    if not frappe.db.exists("Customer", name):
        frappe.get_doc({
            "doctype": "Customer", "customer_name": name, "customer_type": "Individual",
            "customer_group": cgroup, "territory": territory,
        }).insert(ignore_permissions=True)
    return name


# =============================================================================
# steps
# =============================================================================
def _seed_fiscal_year():
    # Fee rows post across Jan–Jun 2026, which span TWO Indian fiscal years
    # (2025-26 = Apr 2025–Mar 2026, 2026-27 = Apr 2026–Mar 2027). Both must
    # exist or Sales Invoices with Jan–Mar 2026 posting dates fail.
    for yr, start, end in (
        ("2025-2026", "2025-04-01", "2026-03-31"),
        ("2026-2027", "2026-04-01", "2027-03-31"),
    ):
        if not frappe.db.exists("Fiscal Year", yr):
            frappe.get_doc({
                "doctype": "Fiscal Year", "year": yr,
                "year_start_date": start, "year_end_date": end,
            }).insert(ignore_permissions=True)
            _log("Fiscal Year %s created" % yr)


def _seed_academic_year():
    if not frappe.db.exists("Academic Year", "2026-2027"):
        frappe.get_doc({
            "doctype": "Academic Year", "academic_year_name": "2026-2027",
            "year_start_date": "2026-04-01", "year_end_date": "2027-03-31",
        }).insert(ignore_permissions=True)
        _log("Academic Year 2026-2027 created")


def _seed_branches():
    n = 0
    for code, name, email, phone, status in BRANCHES:
        if not frappe.db.exists("Branch", name):
            frappe.get_doc({
                "doctype": "Branch", "branch": name,
                "custom_branch_code": code, "custom_email": email,
                "custom_phone": phone, "custom_status": status,
            }).insert(ignore_permissions=True)
            n += 1
    for name in EXTRA_BRANCHES:
        if not frappe.db.exists("Branch", name):
            frappe.get_doc({"doctype": "Branch", "branch": name,
                            "custom_status": "Active"}).insert(ignore_permissions=True)
            n += 1
    _log("Branches: %d created (%d total)" % (n, frappe.db.count("Branch")))


def _seed_designations_programs():
    for d in ("Teacher", "Cleaning Staff", "Non Teaching"):
        _ensure_designation(d)
    for p in ("Playgroup", "Nursery", "KG 1", "KG 2"):
        _ensure_program(p)
    _log("Designations + Programs ensured")


def _seed_staff():
    gender = _a_gender()
    n = 0
    for name, branch, desig, username, phone, status in STAFF:
        if frappe.db.exists("Employee", {"employee_number": username}):
            continue
        try:
            parts = name.split(" ", 1)
            frappe.get_doc({
                "doctype": "Employee",
                "first_name": parts[0], "last_name": parts[1] if len(parts) > 1 else "",
                "employee_name": name, "gender": gender,
                "date_of_birth": "1990-01-01", "date_of_joining": "2024-06-01",
                "company": _company(), "branch": branch, "designation": desig,
                "employee_number": username, "cell_number": phone, "status": status,
            }).insert(ignore_permissions=True)
            n += 1
        except Exception as e:
            _log("  Employee %s FAILED: %s" % (name, e))
    _log("Staff: %d created (%d total)" % (n, frappe.db.count("Employee")))


def _seed_attendance():
    from frappe.utils import today
    emps = frappe.get_all("Employee", filters={"status": "Active"}, fields=["name"])
    statuses = ["Present", "Present", "Present", "Present", "On Leave", "Absent"]
    n = 0
    for i, e in enumerate(emps):
        if frappe.db.exists("Attendance", {"employee": e.name, "attendance_date": today()}):
            continue
        try:
            doc = frappe.get_doc({
                "doctype": "Attendance", "employee": e.name,
                "attendance_date": today(), "status": statuses[i % len(statuses)],
                "company": _company(),
            })
            doc.insert(ignore_permissions=True)
            doc.submit()
            n += 1
        except Exception as ex:
            _log("  Attendance %s FAILED: %s" % (e.name, ex))
    _log("Attendance today: %d marked" % n)


def _seed_students(cgroup, territory):
    # Education auto-creates a website User per Student from student_email_id; our
    # source data has no emails, so skip that (no invented email addresses).
    frappe.db.set_single_value("Education Settings", "user_creation_skip", 1)
    created = {}
    for name, branch, klass, mobile in STUDENTS:
        existing = frappe.db.exists("Student", {"student_name": name})
        if existing:
            created[name] = existing
            continue
        try:
            parts = name.split(" ", 1)
            cust = _ensure_customer(name, cgroup, territory)
            slug = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".")
            doc = frappe.get_doc({
                "doctype": "Student",
                "first_name": parts[0], "last_name": parts[1] if len(parts) > 1 else "",
                "student_email_id": "%s@students.rosemount.local" % slug,
                "student_mobile_number": mobile, "joining_date": "2026-04-01",
                "enabled": 1, "customer": cust, "custom_branch": branch,
            })
            doc.insert(ignore_permissions=True)
            created[name] = doc.name
            # Program Enrollment for current academic year
            try:
                pe = frappe.get_doc({
                    "doctype": "Program Enrollment", "student": doc.name,
                    "program": klass, "academic_year": "2026-2027",
                    "enrollment_date": "2026-04-01", "custom_branch": branch,
                })
                pe.insert(ignore_permissions=True)
                pe.submit()
            except Exception as e:
                _log("  Enrollment %s FAILED: %s" % (name, e))
            # Student Applicant (Admitted) -> admissions funnel "converted"
            try:
                frappe.get_doc({
                    "doctype": "Student Applicant", "first_name": parts[0],
                    "last_name": parts[1] if len(parts) > 1 else "",
                    "application_status": "Admitted", "program": klass,
                    "academic_year": "2026-2027", "custom_branch": branch,
                }).insert(ignore_permissions=True)
            except Exception as e:
                _log("  Applicant %s FAILED: %s" % (name, e))
        except Exception as e:
            _log("  Student %s FAILED: %s" % (name, e))
    _log("Students: %d total, Enrollments: %d, Applicants: %d" % (
        frappe.db.count("Student"), frappe.db.count("Program Enrollment"),
        frappe.db.count("Student Applicant")))
    return created


def _seed_fees(students, cgroup, territory):
    _ensure_item("Tuition Fee", _pick("Item Group", ["Services", "Products", "All Item Groups"]), "Nos")
    income = frappe.db.get_value("Company", _company(), "default_income_account")
    cost_center = frappe.db.get_value("Company", _company(), "cost_center")
    debit_to = frappe.db.get_value("Company", _company(), "default_receivable_account")
    cash = frappe.db.get_value("Company", _company(), "default_cash_account")
    made = 0
    for name, branch, klass, pending, collected, total, midx in FEE_ROWS:
        sid = students.get(name) or frappe.db.exists("Student", {"student_name": name})
        if not sid:
            continue
        # skip if this student already has a submitted invoice
        if frappe.db.exists("Sales Invoice", {"student": sid, "docstatus": 1}):
            continue
        try:
            cust = frappe.db.get_value("Student", sid, "customer") or _ensure_customer(name, cgroup, territory)
            si = frappe.get_doc({
                "doctype": "Sales Invoice", "customer": cust, "company": _company(),
                "posting_date": FEE_MONTHS[midx], "set_posting_time": 1,
                "due_date": FEE_MONTHS[midx], "student": sid, "custom_branch": branch,
                "debit_to": debit_to, "cost_center": cost_center,
                "items": [{
                    "item_code": "Tuition Fee", "qty": 1, "rate": total,
                    "income_account": income, "cost_center": cost_center,
                }],
            })
            si.insert(ignore_permissions=True)
            si.submit()
            made += 1
            if collected > 0:
                try:
                    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
                    pe = get_payment_entry("Sales Invoice", si.name)
                    pe.paid_to = cash
                    pe.reference_no = "FEE-%s" % name.split(" ")[0]
                    pe.reference_date = FEE_MONTHS[midx]
                    pe.posting_date = FEE_MONTHS[midx]
                    for r in pe.references:
                        r.allocated_amount = collected
                    pe.paid_amount = collected
                    pe.received_amount = collected
                    pe.insert(ignore_permissions=True)
                    pe.submit()
                except Exception as e:
                    _log("  Payment for %s FAILED: %s" % (name, e))
        except Exception as e:
            _log("  Invoice %s FAILED: %s" % (name, e))
    _log("Fee invoices: %d created" % made)


def _seed_kit_orders(cgroup, territory):
    grp = _pick("Item Group", ["Products", "Services", "All Item Groups"])
    cost_center = frappe.db.get_value("Company", _company(), "cost_center")
    made = 0
    for oid, kit, branch, amount, date in KIT_ORDERS:
        _ensure_item(kit, grp, "Nos")
        cust = _ensure_customer(branch, cgroup, territory)  # the branch is the buyer
        if frappe.db.exists("Sales Order", {"po_no": oid}):
            continue
        try:
            so = frappe.get_doc({
                "doctype": "Sales Order", "customer": cust, "company": _company(),
                "transaction_date": date, "delivery_date": "2026-06-20",
                "po_no": oid, "custom_branch": branch, "order_type": "Sales",
                "cost_center": cost_center,
                "items": [{
                    "item_code": kit, "qty": 1, "rate": amount,
                    "delivery_date": "2026-06-20", "cost_center": cost_center,
                }],
            })
            so.insert(ignore_permissions=True)
            so.submit()
            made += 1
        except Exception as e:
            _log("  Sales Order %s FAILED: %s" % (oid, e))
    _log("Kit orders (pending): %d created" % made)


def seed_curriculum():
    """A few preschool courses + weekly topics so the Curriculum module has content."""
    courses = ["Pre-Literacy", "Pre-Numeracy", "Rhymes & Music", "Art & Craft", "Story Time", "Physical Play"]
    topics = ["Week 1: All About Me", "Week 2: My Family", "Week 3: Colours", "Week 4: Shapes",
              "Week 5: Numbers 1-10", "Week 6: The Alphabet", "Week 7: Animals", "Week 8: Seasons"]
    nc = nt = 0
    for c in courses:
        if not frappe.db.exists("Course", {"course_name": c}):
            try:
                frappe.get_doc({"doctype": "Course", "course_name": c}).insert(ignore_permissions=True); nc += 1
            except Exception as e:
                print("course %s FAILED: %s" % (c, e))
    for t in topics:
        if not frappe.db.exists("Topic", {"topic_name": t}):
            try:
                frappe.get_doc({"doctype": "Topic", "topic_name": t}).insert(ignore_permissions=True); nt += 1
            except Exception as e:
                print("topic %s FAILED: %s" % (t, e))
    frappe.db.commit()
    print("CURRICULUM courses+%d topics+%d (now %d/%d)" % (
        nc, nt, frappe.db.count("Course"), frappe.db.count("Topic")))


def rename_company(new_name="Rosemount International Preschool"):
    """Rename the default ERPNext company off the 'Ayu' branding."""
    old = "Ayu's company"
    if frappe.db.exists("Company", old):
        frappe.rename_doc("Company", old, new_name, force=True)
        frappe.db.commit()
        print("RENAMED company -> %s" % new_name)
    else:
        print("No 'Ayu's company'. Companies now: %s" % frappe.get_all("Company", pluck="name"))


# --- Phase 1 support data -----------------------------------------------------
# Guardians, an annual calendar and student attendance history. The dashboard's
# student profile, events widget and attendance screens read these.

GUARDIAN_RELATIONS = ["Father", "Mother"]

# label, date, is a real school holiday (vs an event on the calendar)
CALENDAR_2026 = [
    ("Independence Day", "2026-08-15", 1),
    ("Ganesh Chaturthi", "2026-09-14", 1),
    ("Gandhi Jayanti", "2026-10-02", 1),
    ("Dussehra", "2026-10-20", 1),
    ("Diwali Break", "2026-11-08", 1),
    ("Annual Sports Day", "2026-12-12", 0),
    ("Christmas", "2026-12-25", 1),
    ("Annual Day Function", "2027-01-16", 0),
    ("Republic Day", "2027-01-26", 1),
    ("Parent-Teacher Meeting", "2027-02-13", 0),
    ("Holi", "2027-03-03", 1),
]


def _seed_guardians(students):
    """One father + one mother per student, linked via Student.guardians."""
    n = 0
    for sname, sid in (students or {}).items():
        try:
            doc = frappe.get_doc("Student", sid)
        except Exception:
            continue
        if doc.get("guardians"):
            continue
        surname = sname.split(" ")[-1] if " " in sname else sname
        for rel in GUARDIAN_RELATIONS:
            gname = "%s %s" % ("Mr." if rel == "Father" else "Mrs.", surname)
            gid = frappe.db.exists("Guardian", {"guardian_name": gname})
            if not gid:
                slug = re.sub(r"[^a-z0-9]+", ".", gname.lower()).strip(".")
                gid = frappe.get_doc({
                    "doctype": "Guardian", "guardian_name": gname,
                    "email_address": "%s@guardians.rosemount.local" % slug,
                    "mobile_number": doc.get("student_mobile_number") or "",
                    "occupation": "Self Employed" if rel == "Father" else "Homemaker",
                }).insert(ignore_permissions=True).name
            doc.append("guardians", {"guardian": gid, "guardian_name": gname, "relation": rel})
            n += 1
        doc.save(ignore_permissions=True)
    _log("Guardians: %d linked (%d total)" % (n, frappe.db.count("Guardian")))


def _seed_holidays():
    """Annual calendar -> Holiday List. Powers the dashboard events widget.

    Also set as the Company default — Student Attendance validates against the
    company's holiday list and refuses to submit without one.
    """
    name = "Rosemount 2026-2027"
    if not frappe.db.exists("Holiday List", name):
        hl = frappe.get_doc({
            "doctype": "Holiday List", "holiday_list_name": name,
            "from_date": "2026-04-01", "to_date": "2027-03-31",
        })
        for label, date, _is_holiday in CALENDAR_2026:
            hl.append("holidays", {"holiday_date": date, "description": label})
        hl.insert(ignore_permissions=True)
        _log("Holiday List: %s (%d entries)" % (name, len(CALENDAR_2026)))
    if not frappe.db.get_value("Company", _company(), "default_holiday_list"):
        frappe.db.set_value("Company", _company(), "default_holiday_list", name)
        _log("Company default holiday list set -> %s" % name)


def _seed_student_groups(students):
    """One Student Group (class section) per program, holding its enrolled students.

    Student Attendance requires a Student Group or Course Schedule, so these are a
    prerequisite for attendance — and they are the 'class/section' dimension the
    dashboard groups attendance by.
    """
    ay = "2026-2027"
    by_program = {}
    for pe in frappe.get_all("Program Enrollment", filters={"docstatus": 1},
                             fields=["student", "program"]):
        if pe.program:
            by_program.setdefault(pe.program, []).append(pe.student)

    groups = {}
    for program, sids in by_program.items():
        gname = "%s %s" % (program, ay)
        gid = frappe.db.exists("Student Group", {"student_group_name": gname})
        if not gid:
            doc = frappe.get_doc({
                "doctype": "Student Group", "student_group_name": gname,
                "group_based_on": "Batch", "program": program, "academic_year": ay,
            })
            for i, sid in enumerate(sids):
                doc.append("students", {
                    "student": sid,
                    "student_name": frappe.db.get_value("Student", sid, "student_name"),
                    "group_roll_number": i + 1, "active": 1,
                })
            doc.insert(ignore_permissions=True)
            gid = doc.name
        for sid in sids:
            groups[sid] = gid
    _log("Student groups: %d (%d total)" % (len(by_program), frappe.db.count("Student Group")))
    return groups


def _seed_student_attendance(students, groups):
    """Attendance for the last 10 school days so the attendance screen has history."""
    from frappe.utils import add_days, getdate, today
    ids = [s for s in (students or {}).values() if groups.get(s)]
    if not ids:
        _log("Student attendance: skipped (no student groups)")
        return
    n = 0
    day = getdate(today())
    marked = 0
    while marked < 10:
        if day.weekday() < 5:  # Mon–Fri only
            for i, sid in enumerate(ids):
                if frappe.db.exists("Student Attendance", {"student": sid, "date": day}):
                    continue
                # deterministic spread: mostly present, an occasional absentee
                status = "Absent" if ((i + marked) % 11 == 0) else "Present"
                try:
                    d = frappe.get_doc({
                        "doctype": "Student Attendance", "student": sid,
                        "student_group": groups[sid], "date": day, "status": status,
                    })
                    d.insert(ignore_permissions=True)
                    d.submit()
                    n += 1
                except Exception as e:
                    _log("  StudentAttendance %s %s FAILED: %s" % (sid, day, e))
                    return
            marked += 1
        day = add_days(day, -1)
    _log("Student attendance: %d rows over %d school days" % (n, marked))


def run():
    """Entry point. Idempotent — safe to re-run."""
    global LOG
    LOG = []
    cgroup = _pick("Customer Group", ["Individual", "Commercial", "All Customer Groups"])
    territory = _pick("Territory", ["India", "Rest Of The World", "All Territories"])

    # Each step commits independently so a late failure never rolls back earlier
    # progress, and every step's errors surface in one run.
    students = {}
    groups = {}

    def step(label, fn):
        try:
            fn()
            frappe.db.commit()
        except Exception as e:
            frappe.db.rollback()
            _log("STEP %s ABORTED: %s" % (label, e))

    step("fiscal_year", _seed_fiscal_year)
    step("academic_year", _seed_academic_year)
    step("branches", _seed_branches)
    step("designations_programs", _seed_designations_programs)
    step("staff", _seed_staff)
    step("attendance", _seed_attendance)
    step("students", lambda: students.update(_seed_students(cgroup, territory) or {}))
    step("guardians", lambda: _seed_guardians(students))
    step("holidays", _seed_holidays)
    step("student_groups", lambda: groups.update(_seed_student_groups(students) or {}))
    step("student_attendance", lambda: _seed_student_attendance(students, groups))
    step("fees", lambda: _seed_fees(students, cgroup, territory))
    step("kit_orders", lambda: _seed_kit_orders(cgroup, territory))

    # bust the dashboard cache so new numbers show immediately
    try:
        frappe.cache().delete_keys("rmd::")
    except Exception:
        pass

    print("\n".join("  " + l for l in LOG))
    print("SEED COMPLETE")
    return LOG
