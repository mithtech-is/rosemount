import frappe


def run():
    email = "hq.admin@rosemount.local"
    pwd = "Rosemount@HQ2026"
    if not frappe.db.exists("User", email):
        u = frappe.get_doc({
            "doctype": "User", "email": email, "first_name": "HQ", "last_name": "Admin",
            "send_welcome_email": 0, "user_type": "System User",
            "new_password": pwd, "roles": [{"role": "HQ Dashboard"}],
        })
        u.insert(ignore_permissions=True)
        created = True
    else:
        u = frappe.get_doc("User", email)
        u.add_roles("HQ Dashboard")
        from frappe.utils.password import update_password
        update_password(email, pwd)
        created = False
    frappe.db.commit()
    print("HQUSER %s / %s (created=%s)" % (email, pwd, created))
