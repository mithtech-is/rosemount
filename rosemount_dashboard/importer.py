# Copyright (c) 2026, Rosemount International Preschool and contributors
"""Bulk importer for the full SchoolBridge export.

Drop CSV files into a folder, then run:

    bench --site rosemount execute rosemount_dashboard.importer.import_all \
        --kwargs '{"folder": "/home/ayush/frappe-bench/sites/rosemount/private/files/rmimport"}'

Expected files (any subset; headers are case-insensitive, extra columns ignored):

  branches.csv : branch_code, name, email, phone, status
  staff.csv    : name, branch, designation, username, phone, status
  students.csv : name, branch, class, mobile, email
  fees.csv     : student, branch, class, total, collected, posting_date(YYYY-MM-DD)

All steps are idempotent (existing records are skipped) and defensive (a bad row
is logged and skipped, never aborts the run). Reuses the seed primitives.
"""

import csv
import os
import re

import frappe
from . import seed


def _rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        for raw in csv.DictReader(f):
            yield {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}


def import_branches(path):
    n = 0
    for r in _rows(path):
        name = r.get("name") or r.get("branch")
        if not name or frappe.db.exists("Branch", name):
            continue
        try:
            frappe.get_doc({
                "doctype": "Branch", "branch": name,
                "custom_branch_code": r.get("branch_code") or r.get("code") or "",
                "custom_email": r.get("email") or "", "custom_phone": r.get("phone") or "",
                "custom_status": (r.get("status") or "Active").title(),
            }).insert(ignore_permissions=True)
            n += 1
        except Exception as e:
            seed._log("  branch %s: %s" % (name, e))
    frappe.db.commit()
    return n


def import_staff(path):
    gender = seed._a_gender()
    n = 0
    for r in _rows(path):
        name = r.get("name")
        username = r.get("username") or r.get("user") or name
        if not name or frappe.db.exists("Employee", {"employee_number": username}):
            continue
        try:
            desig = r.get("designation") or "Teacher"
            seed._ensure_designation(desig)
            branch = r.get("branch")
            if branch and not frappe.db.exists("Branch", branch):
                frappe.get_doc({"doctype": "Branch", "branch": branch,
                                "custom_status": "Active"}).insert(ignore_permissions=True)
            parts = name.split(" ", 1)
            frappe.get_doc({
                "doctype": "Employee", "first_name": parts[0],
                "last_name": parts[1] if len(parts) > 1 else "", "employee_name": name,
                "gender": gender, "date_of_birth": "1990-01-01", "date_of_joining": "2024-06-01",
                "company": seed._company(), "branch": branch, "designation": desig,
                "employee_number": username, "cell_number": r.get("phone") or "",
                "status": (r.get("status") or "Active").title(),
            }).insert(ignore_permissions=True)
            n += 1
        except Exception as e:
            seed._log("  staff %s: %s" % (name, e))
    frappe.db.commit()
    return n


def import_students(path):
    frappe.db.set_single_value("Education Settings", "user_creation_skip", 1)
    cgroup = seed._pick("Customer Group", ["Individual", "Commercial", "All Customer Groups"])
    territory = seed._pick("Territory", ["India", "All Territories"])
    n = 0
    for r in _rows(path):
        name = r.get("name")
        if not name or frappe.db.exists("Student", {"student_name": name}):
            continue
        try:
            klass = r.get("class") or r.get("program")
            if klass:
                seed._ensure_program(klass)
            branch = r.get("branch")
            if branch and not frappe.db.exists("Branch", branch):
                frappe.get_doc({"doctype": "Branch", "branch": branch,
                                "custom_status": "Active"}).insert(ignore_permissions=True)
            parts = name.split(" ", 1)
            email = r.get("email") or ("%s@students.rosemount.local"
                                       % re.sub(r"[^a-z0-9]+", ".", name.lower()).strip("."))
            cust = seed._ensure_customer(name, cgroup, territory)
            doc = frappe.get_doc({
                "doctype": "Student", "first_name": parts[0],
                "last_name": parts[1] if len(parts) > 1 else "", "student_email_id": email,
                "student_mobile_number": r.get("mobile") or "", "joining_date": "2026-04-01",
                "enabled": 1, "customer": cust, "custom_branch": branch,
            })
            doc.insert(ignore_permissions=True)
            if klass:
                pe = frappe.get_doc({
                    "doctype": "Program Enrollment", "student": doc.name, "program": klass,
                    "academic_year": "2026-2027", "enrollment_date": "2026-04-01",
                    "custom_branch": branch,
                })
                pe.insert(ignore_permissions=True)
                pe.submit()
            n += 1
        except Exception as e:
            seed._log("  student %s: %s" % (name, e))
    frappe.db.commit()
    return n


def import_fees(path):
    seed._ensure_item("Tuition Fee", seed._pick("Item Group", ["Services", "All Item Groups"]), "Nos")
    co = seed._company()
    income = frappe.db.get_value("Company", co, "default_income_account")
    cc = frappe.db.get_value("Company", co, "cost_center")
    debit_to = frappe.db.get_value("Company", co, "default_receivable_account")
    cash = frappe.db.get_value("Company", co, "default_cash_account")
    n = 0
    for r in _rows(path):
        sname = r.get("student") or r.get("name")
        sid = frappe.db.exists("Student", {"student_name": sname}) if sname else None
        if not sid or frappe.db.exists("Sales Invoice", {"student": sid, "docstatus": 1}):
            continue
        try:
            total = float(r.get("total") or 0)
            collected = float(r.get("collected") or 0)
            pdate = r.get("posting_date") or "2026-06-01"
            cust = frappe.db.get_value("Student", sid, "customer")
            si = frappe.get_doc({
                "doctype": "Sales Invoice", "customer": cust, "company": co,
                "posting_date": pdate, "set_posting_time": 1, "due_date": pdate,
                "student": sid, "custom_branch": r.get("branch") or frappe.db.get_value("Student", sid, "custom_branch"),
                "debit_to": debit_to, "cost_center": cc,
                "items": [{"item_code": "Tuition Fee", "qty": 1, "rate": total,
                           "income_account": income, "cost_center": cc}],
            })
            si.insert(ignore_permissions=True)
            si.submit()
            n += 1
            if collected > 0:
                from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
                pe = get_payment_entry("Sales Invoice", si.name)
                pe.paid_to = cash
                pe.reference_no = "FEE-IMP"
                pe.reference_date = pdate
                pe.posting_date = pdate
                for ref in pe.references:
                    ref.allocated_amount = collected
                pe.paid_amount = collected
                pe.received_amount = collected
                pe.insert(ignore_permissions=True)
                pe.submit()
        except Exception as e:
            seed._log("  fee %s: %s" % (sname, e))
    frappe.db.commit()
    return n


def import_all(folder):
    """Import every known CSV present in `folder`. Returns a summary dict."""
    seed.LOG = []
    # prerequisites the fee/student steps rely on
    seed._seed_fiscal_year()
    seed._seed_academic_year()
    frappe.db.commit()

    summary = {}
    plan = [("branches.csv", import_branches), ("staff.csv", import_staff),
            ("students.csv", import_students), ("fees.csv", import_fees)]
    for fname, fn in plan:
        path = os.path.join(folder, fname)
        summary[fname] = fn(path) if os.path.exists(path) else "skipped (not found)"

    try:
        frappe.cache().delete_keys("rmd::")
    except Exception:
        pass
    print("IMPORT SUMMARY:", summary)
    if seed.LOG:
        print("\n".join(seed.LOG))
    return summary
