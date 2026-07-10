import frappe
from frappe.utils.password import update_password

EMAIL = "teacher@rosemount.local"
PWD = "Rosemount@Emp2026"

# pick a seeded employee (prefer one not yet linked to a user)
emp = frappe.get_all(
    "Employee",
    filters={"status": "Active"},
    fields=["name", "employee_name", "user_id"],
    order_by="creation asc",
    limit=20,
)
target = next((e for e in emp if not e.user_id), emp[0] if emp else None)
if not target:
    print("NO_EMPLOYEE_FOUND")
else:
    name_parts = (target.employee_name or "Teacher").split(" ", 1)
    first = name_parts[0]
    last = name_parts[1] if len(name_parts) > 1 else ""

    if not frappe.db.exists("User", EMAIL):
        u = frappe.get_doc({
            "doctype": "User",
            "email": EMAIL,
            "first_name": first,
            "last_name": last,
            "send_welcome_email": 0,
            "enabled": 1,
            "user_type": "System User",
        })
        u.insert(ignore_permissions=True)
    else:
        u = frappe.get_doc("User", EMAIL)
        u.enabled = 1
        u.save(ignore_permissions=True)

    if "Employee" not in {r.role for r in u.roles} and frappe.db.exists("Role", "Employee"):
        u.add_roles("Employee")

    update_password(EMAIL, PWD)

    # link the employee record to this user (enables self-service scoping)
    ed = frappe.get_doc("Employee", target.name)
    ed.user_id = EMAIL
    ed.save(ignore_permissions=True)

    frappe.db.commit()
    print("EMP_NAME:", target.employee_name)
    print("EMP_ID:", target.name)
    print("LOGIN_EMAIL:", EMAIL)
    print("PASSWORD:", PWD)
    print("ROLES:", sorted({r.role for r in frappe.get_doc("User", EMAIL).roles}))
    print("DONE")
