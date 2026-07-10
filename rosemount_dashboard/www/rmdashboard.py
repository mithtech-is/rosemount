# Copyright (c) 2026, Rosemount International Preschool and contributors
"""Controller for the single HQ dashboard page served at /rmdashboard.

Gates access server-side: Guests are redirected to login; signed-in users must
hold the 'HQ Dashboard' role (or System Manager). The page then calls the
whitelisted rosemount_dashboard.api.* methods from the browser using the
session cookie (same-origin), so HQ never touches the Frappe Desk.
"""

import frappe


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/rmdashboard"
        raise frappe.Redirect

    roles = frappe.get_roles()
    if "HQ Dashboard" not in roles and "System Manager" not in roles:
        frappe.throw(
            "This dashboard is restricted to HQ administrators.",
            frappe.PermissionError,
        )

    context.no_cache = 1
    context.full_name = frappe.utils.get_fullname(frappe.session.user)
    context.csrf_token = frappe.sessions.get_csrf_token()  # for POST write calls
    return context
