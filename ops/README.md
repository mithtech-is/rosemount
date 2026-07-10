# Rosemount Dashboard

A single HQ dashboard for **Rosemount International Preschool**, served from the
Frappe site itself — HQ administrators open one URL, log in once, and see every
branch's students, fees, staff, attendance, admissions and kit orders without
ever touching the Frappe Desk.

```
Dashboard URL :  https://<site>/rmdashboard
Login         :  hq.admin@rosemount.local  /  Rosemount@HQ2026   (change this)
```

Built as a Frappe app (no React/Vue build step — a server-rendered page +
whitelisted aggregation APIs), so nothing depends on the bench's asset pipeline.

---

## Environment

| | |
|---|---|
| Frappe / ERPNext / HRMS | 16.10.10 / 16.8.2 / 16.4.2 (v16) |
| Education | 16.0.1 (installed for this project) |
| Site | `rosemount` (bench: `~/frappe-bench`, inside WSL Ubuntu-24.04) |

---

## Architecture

```
Browser ─GET /rmdashboard─▶ www/rmdashboard.py    (login + HQ-role gate)
        ◀── SPA shell ────  www/rmdashboard.html  (mounts the React app on #root)
        ◀── /assets/rosemount_dashboard/rmdash/app.{js,css}  (built Vite bundle)
        ─GET /api/method/rosemount_dashboard.api.*  (session cookie)─▶ api.py (11 endpoints)
```

The dashboard is a **Vite + React + shadcn/ui** single-page app (icons from
**@deemlol/next-icons**), reproducing the SchoolBridge "HQ Console" design — navy
sidebar with 16 sections and all the screens (Dashboard, Branches, Staff,
Students, Fees, Attendance, Billing, Enquiry, Inventory, Kit Ordering, Invoices,
Curriculum, SMS/Email, Broadcast, Reports, Settings). Data-backed screens read
the live endpoints; the rest use the SchoolBridge reference data.

- **Served from Frappe (same-origin).** The built bundle lives in the app's
  `public/rmdash/` (served at `/assets/rosemount_dashboard/rmdash/`); a thin
  login-gated `www` page mounts it at `/rmdashboard`. Same-origin → the browser
  session cookie authenticates the API calls (no CORS, no token).
- **One login.** Guests are redirected to `/login`; signed-in users must hold the
  `HQ Dashboard` role (or System Manager). The same gate (`_require_hq`) protects
  every API method server-side.
- **Independent of `bench build`.** The SPA is built by its own Vite toolchain
  (`dashboard-ui/`), so the bench's broken yarn/esbuild asset pipeline is bypassed.

---

## Decisions (the "adapt and note it" items)

### Branch dimension = ERPNext `Branch` doctype
One Company, many **Branches** (one `Branch` record per preschool). Chosen over
Company-per-branch because seeding ~20 companies (each a full chart of accounts)
is heavy and fragile. `install.py` adds:

- `custom_branch_code`, `custom_email`, `custom_phone`, `custom_status` on **Branch**
- `custom_branch` (Link → Branch) on **Sales Invoice, Sales Order, Student, Student Applicant**

`Employee` uses its native `branch` field; `Attendance` is scoped via the
employee's branch. The `branch` arg every endpoint takes is a **Branch name**
(e.g. `?branch=RMIPS%20Horamavu`).

### Fee source = submitted `Sales Invoice` (not legacy `Fees`)
Education v16's Sales Invoice has a native `student` link. Money metrics use
`docstatus = 1` invoices: `total = sum(grand_total)`,
`collected = sum(grand_total − outstanding_amount)`, `pending = sum(outstanding_amount)`.
Partial collection is modelled with Payment Entries. `fee_by_branch` /
`fee_collection_trend` return **₹ lakh**; `fee_overview` / `fee_rows` return raw ₹.

### Admissions funnel mapping
`Student Applicant.application_status`: `Applied | Approved | Rejected | Admitted`
→ converted = `Admitted`, dropped = `Rejected`, followup = `Applied`+`Approved`.
`dashboard_summary.pendingAdmissions` counts `Applied`.

### Other notes
- Branch active/inactive from `custom_status`. Staff "Verified" flag omitted (no
  such Employee field); the SchoolBridge username is stored in `employee_number`.
- Attendance folds `Half Day` / `Work From Home` into `present`.

---

## Endpoints (`/api/method/rosemount_dashboard.api.<method>`)

| Method | Args | Shape |
|---|---|---|
| `dashboard_summary` | `branch?` | `{branches, branchesActive, students, staff, pendingAdmissions}` |
| `fee_overview` | `branch?` | `{total, collected, pending}` ₹ |
| `fee_by_branch` | — | `[{branch, value}]` ₹ lakh |
| `fee_collection_trend` | `branch?` | `[{m, collected, pending}]` last 6 months, ₹ lakh |
| `admissions_funnel` | `branch?` | `{total, converted, dropped, followup}` |
| `pending_kit_orders` | `branch?` | `[[order, kit, branch, type, payment, amount, date]]` ≤10 |
| `attendance_today` | `branch?` | `{present, absent, leave, total}` |
| `branches` | — | `[[id, name, email, phone, status]]` |
| `staff_list` | `branch?` | `[[name, branch, designation, username, phone, status]]` |
| `student_list` | `branch?` | `[[adm_no, name, branch, class, mobile, status]]` |
| `fee_rows` | `branch?`, `limit?` | `[[student, branch, class, pending, collected, total]]` |
| `inventory_list` | — | `[[sno, product, category, status, price, qty]]` (ERPNext Item) |
| `invoice_list` | `branch?` | `[[sr, order, date, invoice, amount, status]]` (Sales Invoice) |
| `billing_categories` | — | `[[category, date, created_by, active]]` (Item Group) |
| `curriculum_list` | — | `[[pdf, school, category, topic, status, start, end]]` (Program) |
| `reports_list` | — | `[[report, module, requested, generated, status]]` (Frappe Report) |
| `settings_info` | — | `{systemName, systemTitle, email, phone, country, …}` (Company) |

Every one of the 16 screens reads live data. **Working controls** (no extra
backend): live **search** + **rows-per-page** + **CSV export** + **reset** on
every table (see `dashboard-ui/src/lib/table.ts`), the header **branch filter**,
and tab switching.

**Writes (POST + CSRF):** Add (Branch/Staff/Student/Product/Category) open modal
forms that create real records; Edit (Branch email/phone/status, Item price) and
Delete (Branch/Student/Item/Item Group, with confirm + link-guard) persist via
`add_*` / `update_doc` / `remove_doc`; Settings Save updates the Company; Broadcast
records a Note. All show toasts and auto-refresh. CSRF token is injected into the
page by `www/rmdashboard.py` and sent on every POST.

**Still integration-dependent (toast-acknowledged, not wired):** actual SMS/WhatsApp/
email **delivery** (needs a gateway like Twilio), ID-card PDF printing, kit
accept/dispatch Sales-Order workflow, and date-range attendance reports.

---

## Data

The site is seeded with the **real, named** Rosemount records from the
SchoolBridge dashboard sources (17 branches with codes/emails/phones, 6 staff,
8 students + enrollments, 6 fee invoices with partial payments, 3 pending kit
orders, today's attendance). Aggregate screenshot totals (1,860 students, 412
staff…) are larger than the named rows available — load the full export to reach
them.

### Re-run the seed (idempotent)
```bash
bench --site rosemount execute rosemount_dashboard.seed.run
```

### Import the full SchoolBridge export
Put CSVs in a folder and run:
```bash
bench --site rosemount execute rosemount_dashboard.importer.import_all \
  --kwargs '{"folder": "/home/ayush/frappe-bench/sites/rosemount/private/files/rmimport"}'
```
CSV headers (any subset, case-insensitive):
```
branches.csv : branch_code, name, email, phone, status
staff.csv    : name, branch, designation, username, phone, status
students.csv : name, branch, class, mobile, email
fees.csv     : student, branch, class, total, collected, posting_date
```
Both seed and importer are idempotent (existing records skipped) and defensive
(a bad row is logged and skipped, never aborts the run).

---

## Operations

```bash
# Required services (this bench runs them on non-standard ports)
redis-server config/redis_cache.conf --daemonize yes   # 13000
redis-server config/redis_queue.conf --daemonize yes   # 11000
bench --site rosemount serve --port 8090                      # web (8000 was in use)

# Grant a user dashboard access
bench --site rosemount add-role <user@example.com> "HQ Dashboard"

# Flush the 5-minute dashboard cache after a data import
bench --site rosemount execute rosemount_dashboard.api.clear_cache
```

> **Production:** run under supervisor/nginx (`bench setup production`) instead of
> `bench serve`, and change the `hq.admin` password. The known limitation that
> `allow_cors` does not cover socket.io realtime is irrelevant here — the
> dashboard is same-origin inside Frappe.

---

## Files

```
apps/rosemount_dashboard/
  rosemount_dashboard/
    api.py                  11 whitelisted endpoints + branch helper + HQ guard + cache
    install.py              HQ Dashboard role + custom fields (after_install)
    seed.py                 real Rosemount data (idempotent)
    importer.py             full-export CSV importer
    www/rmdashboard.py      login + HQ-role gate (controller)
    www/rmdashboard.html    SPA shell that mounts the React app at /rmdashboard
    public/rmdash/          built Vite bundle (app.js/app.css) — served as /assets/...
  dashboard-ui/             React SPA source (Vite + shadcn/ui + @deemlol/next-icons)
    src/App.tsx             shell: sidebar + topbar + screen router + data fetching
    src/screens.tsx         all 16 screens
    src/lib/api.ts          same-origin Frappe API client
    src/lib/ui.tsx          Sidebar, Topbar, shared primitives
    src/lib/static.ts       SchoolBridge reference data (non-live screens)
    src/components/ui/       shadcn/ui components
```

## Rebuilding the dashboard UI

After editing anything under `dashboard-ui/src/`, rebuild and republish:

```bash
cd ~/frappe-bench/apps/rosemount_dashboard/dashboard-ui
npm run build
rm -rf ../rosemount_dashboard/public/rmdash && cp -r dist ../rosemount_dashboard/public/rmdash
```

The `www/rmdashboard.html` shell references stable names (`assets/app.js`,
`assets/app.css`), so it does not change between builds. Hard-refresh the browser
to pick up a new bundle.
