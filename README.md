# Rosemount HQ Dashboard (`rosemount_dashboard`)

A [Frappe](https://frappeframework.com/) / [ERPNext](https://erpnext.com/) app that gives
**Rosemount International Preschool** a single **HQ console** at **`/rmdashboard`** — one URL, one
login, and every branch's students, staff, fees, admissions, attendance, inventory and kit orders in
one place, without ever touching the Frappe Desk.

The console is a **React single-page app** served from Frappe itself (same-origin). It is gated
server-side (only the `HQ Dashboard` role or a `System Manager` can open it) and reads whitelisted
`rosemount_dashboard.api.*` endpoints using the session cookie.

```
Dashboard URL :  http://<site>/rmdashboard
Default login :  hq.admin@rosemount.local  /  Rosemount@HQ2026   (change this)
```

> ⚠️ **This repository is one Frappe *app*, not a whole system.**
> Cloning it does **not** give you a running ERP. It contains **no site, no database, and none of the
> other apps** (Frappe, ERPNext, HRMS, Education). You install it *onto* a Frappe bench that already
> has those apps. Nothing shows in the Desk from this repo alone — the Desk workspaces (Accounting,
> Payroll, Education, …) belong to those other apps. See [Requirements](#requirements) →
> [Installation](#installation).

---

## Table of contents

1. [Requirements](#requirements)
2. [Installation](#installation)
3. [Load data](#load-data)
4. [Create the HQ login](#create-the-hq-login)
5. [Open the dashboard](#open-the-dashboard)
6. [Architecture](#architecture)
7. [Design decisions](#design-decisions)
8. [API endpoints](#api-endpoints)
9. [Developing the UI](#developing-the-ui)
10. [Switching / reverting the UI](#switching--reverting-the-ui)
11. [Project structure](#project-structure)
12. [Troubleshooting](#troubleshooting)
13. [Security notes](#security-notes)

---

## Requirements

A working **Frappe Framework v16 bench** with these apps installed **on the same site**:

| App | Provides |
| --- | --- |
| `frappe` (v16) | The framework |
| `erpnext` (v16) | Company, Customer, Item, Sales Invoice (fees), Sales Order (kit orders) |
| `hrms` (v16 · "Frappe HR") | Employees / staff |
| `education` (v16) | Student, Program, Program Enrollment, Student Applicant |

Bench prerequisites: **Python 3.10+**, **Node 18+ / Yarn**, **MariaDB 10.6+**, **Redis**.
No bench yet? Follow the official
[Frappe install guide](https://frappeframework.com/docs/user/en/installation) first.

---

## Installation

Run these from your bench root (`frappe-bench/`). Replace `<site>` with your site name
(on the reference machine it is `rosemount`).

```bash
# 1. Fetch this app and the prerequisite apps into the bench
bench get-app erpnext
bench get-app hrms
bench get-app education
bench get-app https://github.com/mithtech-is/rosemount.git rosemount_dashboard

# 2. Create a site (skip if you already have one)
bench new-site <site>

# 3. Install the apps ON the site — order matters (deps first)
bench --site <site> install-app erpnext
bench --site <site> install-app hrms
bench --site <site> install-app education
bench --site <site> install-app rosemount_dashboard

# 4. Build front-end assets and sync the schema
bench build
bench --site <site> migrate
```

Installing `rosemount_dashboard` automatically creates the **`HQ Dashboard`** role and the custom
fields it needs (`after_install` in `install.py`).

The React dashboard ships **pre-built** in `rosemount_dashboard/public/rmdash/`, so you do **not**
need an `npm` build just to use it — only to change the UI (see [Developing the UI](#developing-the-ui)).

---

## Load data

A fresh install has no students / branches / fees. Load the built-in demo dataset (real, named
Rosemount records) — this is **idempotent** (safe to re-run):

```bash
bench --site <site> execute rosemount_dashboard.seed.run
```

It creates: fiscal years 2025-26 & 2026-27, an academic year, ~17 branches, staff, students +
enrollments + applicants, today's attendance, fee invoices (with partial payments) and kit orders.

### Load a larger export (optional)

`seed.run` only loads the *named* rows in `seed.py`. For a bigger dataset, put four CSVs in a folder
and run the importer (also idempotent; bad rows are logged and skipped):

```bash
bench --site <site> execute rosemount_dashboard.importer.import_all \
  --kwargs '{"folder": "/absolute/path/to/csvs"}'
```

```
branches.csv : branch_code, name, email, phone, status
staff.csv    : name, branch, designation, username, phone, status
students.csv : name, branch, class, mobile, email
fees.csv     : student, branch, class, total, collected, posting_date(YYYY-MM-DD)
```

---

## Create the HQ login

The dashboard needs a user with the **`HQ Dashboard`** role (created for you at install time).
Create one and set its password:

```bash
bench --site <site> console
```
```python
import frappe
email, pwd = "hq.admin@rosemount.local", "Rosemount@HQ2026"   # change the password
if not frappe.db.exists("User", email):
    frappe.get_doc({
        "doctype": "User", "email": email, "first_name": "HQ", "last_name": "Admin",
        "send_welcome_email": 0, "user_type": "System User",
        "new_password": pwd, "roles": [{"role": "HQ Dashboard"}],
    }).insert(ignore_permissions=True)
    frappe.db.commit()
    print("created", email)
```

To give the role to an **existing** user instead:

```bash
bench --site <site> add-role <user@example.com> "HQ Dashboard"
```

Any `System Manager` (e.g. `Administrator`) can also open the dashboard.

---

## Open the dashboard

Start the site:

```bash
bench start                          # full stack: web + socketio + workers + scheduler
# or a single web process on a custom port:
bench --site <site> serve --port 8200
```

Then:

- **HQ dashboard:** `http://localhost:8200/rmdashboard` — log in as `hq.admin@rosemount.local`.
- **Frappe Desk** (ERPNext / HR / Education admin): `http://localhost:8200/app` — log in as a
  `System Manager`. Workspaces are grouped **by app** in the top-left **app switcher**
  (ERPNext · Frappe HR · Education · Frappe).

> Prefer `bench start` over `bench serve` if you want Desk realtime notifications — `serve` alone
> does not run the socketio process.

---

## Architecture

```
Browser ─GET /rmdashboard──▶ www/rmdashboard.py   (login + HQ-role gate)
        ◀── SPA shell ─────  www/rmdashboard.html  (mounts the React app on #root)
        ◀── /assets/rosemount_dashboard/rmdash/app.{js,css}   (pre-built Vite bundle)
        ─GET /api/method/rosemount_dashboard.api.*  (session cookie)─▶ api.py
```

- **Same-origin.** The built bundle lives in `public/rmdash/` (served at
  `/assets/rosemount_dashboard/rmdash/`); a thin login-gated `www` page mounts it at `/rmdashboard`.
  The browser session cookie authenticates the API calls — no CORS, no tokens.
- **One gate.** Guests are redirected to `/login`; signed-in users must hold `HQ Dashboard` (or
  `System Manager`). The same guard (`_require_hq`) protects every API method server-side.
- **Independent of `bench build`.** The SPA has its own Vite toolchain (`dashboard-ui/`), so a broken
  bench asset pipeline never blocks the dashboard.

---

## Design decisions

- **Branch dimension = ERPNext `Branch` doctype** (one Company, many Branches) — lighter than a
  Company-per-branch. `install.py` adds `custom_branch_code/email/phone/status` on **Branch** and a
  `custom_branch` link on **Sales Invoice, Sales Order, Student, Student Applicant**. Every endpoint's
  `branch` arg is a Branch *name* (e.g. `?branch=RMIPS%20Horamavu`).
- **Fees = submitted `Sales Invoice`** (native `student` link). `total = Σ grand_total`,
  `collected = Σ (grand_total − outstanding)`, `pending = Σ outstanding`. Charts return ₹ lakh;
  `fee_overview`/`fee_rows` return raw ₹.
- **Admissions funnel** from `Student Applicant.application_status`: converted = `Admitted`,
  dropped = `Rejected`, follow-up = `Applied` + `Approved`; `pendingAdmissions` counts `Applied`.

---

## API endpoints

All under `/api/method/rosemount_dashboard.api.<method>`, gated by `HQ Dashboard` / `System Manager`.

| Method | Args | Returns |
|---|---|---|
| `dashboard_summary` | `branch?` | `{branches, branchesActive, students, staff, pendingAdmissions}` |
| `fee_overview` | `branch?` | `{total, collected, pending}` ₹ |
| `fee_by_branch` | — | `[{branch, value}]` ₹ lakh |
| `fee_collection_trend` | `branch?` | `[{m, collected, pending}]` last 6 months |
| `admissions_funnel` | `branch?` | `{total, converted, dropped, followup}` |
| `pending_kit_orders` | `branch?` | `[[order, kit, branch, type, payment, amount, date]]` |
| `attendance_today` | `branch?` | `{present, absent, leave, total}` |
| `branches` / `staff_list` / `student_list` / `fee_rows` | `branch?` | table rows |
| `inventory_list` / `invoice_list` / `billing_categories` / `curriculum_list` / `reports_list` | — | table rows |
| `settings_info` | — | `{systemName, email, phone, country, …}` |

**Writes (POST + CSRF):** `add_branch` · `add_staff` · `add_student` · `add_product` · `add_category` ·
`update_doc` · `remove_doc` · `save_settings` · `send_broadcast`. The CSRF token is injected by
`www/rmdashboard.py` and sent on every POST.

Tables have live search, rows-per-page, CSV export and reset (`dashboard-ui/src/lib/table.ts`).
Not wired (toast-acknowledged): SMS/WhatsApp/email delivery, ID-card PDFs, and the kit
accept/dispatch Sales-Order workflow.

---

## Developing the UI

The dashboard is a **React 19 + Vite + Tailwind v4 + shadcn** project in `dashboard-ui/`.

```bash
cd dashboard-ui
npm install
npm run build                                  # outputs to dashboard-ui/dist/
rm -rf ../rosemount_dashboard/public/rmdash
cp -r dist ../rosemount_dashboard/public/rmdash
bench --site <site> clear-cache
```

Hard-refresh the browser (**Ctrl+Shift+R**) afterwards — the asset names (`app.js` / `app.css`) are
stable, so the shell (`www/rmdashboard.html`) never changes and the old bundle is cached.

Key files: `src/screens.tsx` (all screens) · `src/lib/ui.tsx` (sidebar/topbar/primitives) ·
`src/lib/api.ts` (API client) · `src/brand.css` (brand tokens + visual polish) · `src/index.css`
(Tailwind theme + Geist font).

---

## Switching / reverting the UI

The bundle folder can hold several saved UI versions side by side. `ops/rmdash-ui.sh` swaps the live
one with no rebuild:

```bash
bash ops/rmdash-ui.sh list        # show saved versions
bash ops/rmdash-ui.sh polished    # serve the polished UI
bash ops/rmdash-ui.sh original    # revert to the earlier flat UI
```

Saved versions live as `rosemount_dashboard/public/rmdash-<name>/` and are git-ignored.

---

## Project structure

```
rosemount_dashboard/
├── rosemount_dashboard/           # the Frappe app (Python)
│   ├── api.py                     # whitelisted dashboard endpoints + HQ guard + cache
│   ├── install.py                 # after_install: HQ Dashboard role + custom fields
│   ├── hooks.py
│   ├── seed.py                    # demo-data seeder  (seed.run)
│   ├── importer.py                # full-export CSV importer  (import_all)
│   ├── www/rmdashboard.{html,py}  # login-gated SPA shell + role gate
│   └── public/rmdash/             # pre-built React bundle (served at /assets/...)
├── dashboard-ui/                  # React/Vite source for the dashboard
│   └── src/                       # screens, ui primitives, api client, styles
├── ops/                           # helper scripts (launcher, seeders, UI switch)
├── pyproject.toml
└── README.md
```

---

## Troubleshooting

- **Login page blank · console shows `$ is not defined` · 404s on `*.bundle.css`** — the Frappe/ERPNext
  web assets aren't built. Run `bench build` (add `bench build --app erpnext` if needed).
- **Seeding fees fails: `Unknown column 'tabContact.is_billing_contact'`** — ERPNext's post-install
  custom fields never ran (e.g. a restored/drifted site). Fix once:
  `bench --site <site> execute erpnext.setup.install.create_address_and_contact_custom_fields`.
- **`Posting Date … is not in any active Fiscal Year`** — the fiscal year is missing. `seed.run` now
  creates both 2025-26 and 2026-27; add others under *Accounting → Fiscal Year*.
- **`/rmdashboard` returns 404** — app not installed on the site, or stale cache:
  `bench --site <site> install-app rosemount_dashboard && bench --site <site> clear-cache`.
- **`/rmdashboard` loops back to `/login`** — the user lacks the `HQ Dashboard` role
  (see [Create the HQ login](#create-the-hq-login)).
- **HR / Education "missing" in the Desk** — they're separate apps under the top-left **app switcher**,
  and only visible to a login that has their roles (e.g. `Administrator`).

---

## Security notes

- Scripts in `ops/` contain **demo passwords** (`hquser.py`, `create_emp_login.py`) and
  **machine-specific paths** (WSL `/mnt/c/...`). Change them before any real use — never rely on the
  defaults. The demo passwords only authenticate against a local dev site.
- For production, run under supervisor/nginx (`bench setup production`) rather than `bench serve`, and
  change the `hq.admin` and `Administrator` passwords.

---

## License

See [`license.txt`](license.txt).
