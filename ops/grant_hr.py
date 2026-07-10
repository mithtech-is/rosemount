import frappe

u = "hq.admin@rosemount.local"
user = frappe.get_doc("User", u)
have = {r.role for r in user.roles}
want = [r for r in ["HR Manager", "HR User", "Employee"]
        if frappe.db.exists("Role", r) and r not in have]
if want:
    user.add_roles(*want)
user.reload()
print("USER:", u)
print("ENABLED:", user.enabled)
print("ROLES_NOW:", sorted({r.role for r in user.roles}))
print("EMPLOYEE_LINK:", frappe.db.get_value("Employee", {"user_id": u}, "name") or "NONE")
frappe.db.commit()
print("DONE")
