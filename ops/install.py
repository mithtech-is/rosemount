# Copyright (c) 2026, Rosemount International Preschool and contributors
"""Install-time setup for rosemount_dashboard.

Wired via hooks.py `after_install`. Also safe to run by hand (idempotent):

    bench --site <site> execute rosemount_dashboard.install.after_install
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def after_install():
    _ensure_hq_role()
    _ensure_custom_fields()
    _backfill_kit_status()
    frappe.db.commit()


def _backfill_kit_status():
    """Existing kit Sales Orders get a default 'Pending' workflow status."""
    try:
        frappe.db.sql("""
            update `tabSales Order` set custom_kit_status = 'Pending'
            where docstatus = 1 and (custom_kit_status is null or custom_kit_status = '')
              and custom_branch is not null and custom_branch != ''
        """)
    except Exception:
        pass


def _ensure_hq_role():
    """The 'HQ Dashboard' role gates every API endpoint (see api._require_hq)."""
    if not frappe.db.exists("Role", "HQ Dashboard"):
        frappe.get_doc({
            "doctype": "Role",
            "role_name": "HQ Dashboard",
            "desk_access": 1,
        }).insert(ignore_permissions=True)


def _ensure_custom_fields():
    """Branch == ERPNext Branch doctype is the dashboard's branch dimension.

    Branch carries display metadata; transaction/education doctypes get a
    `custom_branch` Link -> Branch so they can be scoped. `create_custom_fields`
    is idempotent and updates existing fields in place."""
    branch_link = {
        "fieldname": "custom_branch",
        "label": "Branch",
        "fieldtype": "Link",
        "options": "Branch",
        "search_index": 1,
    }
    create_custom_fields(
        {
            "Branch": [
                {"fieldname": "custom_branch_code", "label": "Branch Code",
                 "fieldtype": "Data", "insert_after": "branch"},
                {"fieldname": "custom_email", "label": "Email",
                 "fieldtype": "Data", "options": "Email", "insert_after": "custom_branch_code"},
                {"fieldname": "custom_phone", "label": "Phone",
                 "fieldtype": "Data", "insert_after": "custom_email"},
                {"fieldname": "custom_status", "label": "Status", "fieldtype": "Select",
                 "options": "Active\nInactive", "default": "Active", "insert_after": "custom_phone"},
            ],
            "Sales Invoice": [dict(branch_link, insert_after="cost_center")],
            "Sales Order": [
                dict(branch_link, insert_after="cost_center"),
                {"fieldname": "custom_kit_status", "label": "Kit Status", "fieldtype": "Select",
                 "options": "Pending\nAccepted\nDispatched\nCompleted\nRejected",
                 "default": "Pending", "insert_after": "custom_branch"},
            ],
            "Student": [dict(branch_link, insert_after="customer_group")],
            "Student Applicant": [
                dict(branch_link, insert_after="program"),
                {"fieldname": "custom_source", "label": "Enquiry Source", "fieldtype": "Select",
                 "options": "Website\nWalk-in\nReferral\nPhone\nSocial Media\nOther",
                 "insert_after": "custom_branch"},
            ],
        },
        ignore_validate=True,
    )
