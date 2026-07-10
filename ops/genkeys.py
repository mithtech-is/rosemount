import frappe
from frappe.core.doctype.user.user import generate_keys


def run():
    res = generate_keys("Administrator")
    api_key = frappe.db.get_value("User", "Administrator", "api_key")
    frappe.db.commit()
    print("KEYS %s:%s" % (api_key, res["api_secret"]))
