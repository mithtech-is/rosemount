// Static reference data (from the SchoolBridge design) for screens not backed by
// live endpoints yet. Live screens fetch from the API instead.

export const INVENTORY = [
  ["1", "Premium Student Kit - KG 2", "Child Kit - KG 2", "Active", "5,250.00", "0"],
  ["2", "Premium Student Kit - KG 1", "Child Kit - KG 1", "Active", "5,000.00", "0"],
  ["3", "Premium Student Kit - Nursery", "Child Kit - Nursery", "Active", "4,250.00", "0"],
  ["4", "Premium Student Kit - Play Group", "Child Kit - PG", "Active", "4,250.00", "0"],
  ["5", "Hoodie", "Hoodie", "Active", "750.00", "0"],
  ["6", "Standard Student Kit - KG 2", "Child Kit - KG 2", "Active", "8,000.00", "0"],
];

export const INVOICES = [
  ["1", "6464", "3 Jun 2026", "INVKITPROD0051", "2,200.00", "Paid"],
  ["2", "6463", "3 Jun 2026", "INVKITPROD0050", "77,000.00", "Paid"],
  ["3", "6435", "2 Jun 2026", "INVKITPROD0049", "26,400.00", "Paid"],
  ["4", "6357", "2 Jun 2026", "INVKITPROD0048", "33,000.00", "Paid"],
  ["5", "6311", "2 Jun 2026", "INVKITPROD0047", "98,000.00", "Paid"],
  ["6", "6340", "2 Jun 2026", "INVKITPROD0046", "44,500.00", "Unpaid"],
];

export const BILLING_CATS = [
  ["Student Kit - KG 2", "16 Apr 2026", "Admin", true],
  ["Student Kit - KG 1", "16 Apr 2026", "Admin", true],
  ["Student Kit - Nursery", "16 Apr 2026", "Admin", true],
  ["Student Kit - Playgroup", "16 Apr 2026", "Admin", true],
];

export const CURRICULUM = [
  ["Playgroup Curri…", "RMIPS Carmelaram", "June 2024", "Playgroup curriculum 2024", "Inactive", "03-Jun-2025", "23-Jul-2025"],
  ["First week for…", "RMIPS Carmelaram", "Teachers Resources", "First week for first timers", "Inactive", "03-Jun-2025", "23-Jul-2025"],
  ["Ukg curriculum…", "RMIPS Carmelaram", "June 2024", "UKG Curriculum", "Inactive", "07-Jun-2025", "27-Jul-2025"],
  ["LKG curriculum…", "RMIPS Carmelaram", "June 2024", "LKG Curriculum", "Inactive", "07-Jun-2025", "27-Jul-2025"],
];

export const CLASSES = ["Playgroup", "Nursery", "Junior kg", "Senior K.G", "First", "Second", "Third", "Fourth", "Fifth"];

export const SMS_MATRIX: Record<string, [string, boolean, boolean][]> = {
  Administration: [
    ["Admission Enquiry", true, false], ["Birthday Reminder", true, false],
    ["Fees", false, true], ["Insta Alert", true, true], ["Staff", false, false], ["Student", false, true],
  ],
  Academics: [["Attendance", false, false], ["School Diary", true, false]],
  "Events and Gallery": [["Events", true, true]],
};

export const REPORTS = [
  ["Fees Collection — May", "Fees", "02 Jun 2026", "02 Jun 2026", "Completed"],
  ["Attendance — Branch Wise", "Attendance", "01 Jun 2026", "01 Jun 2026", "Completed"],
  ["Enquiry Funnel Q1", "Enquiry", "30 May 2026", "—", "Pending"],
];

export const NOTICES: [string, string, string, string][] = [
  ["Holiday", "Muharram", "25 Jun 2026", "#f5b820"],
  ["Renewal", "Application renewal due", "07 Jun 2026", "#e05a5a"],
  ["Event", "Annual Sports Day", "15 Jul 2026", "#2456c4"],
];

// Quick actions: [label, NextIcons name, yellow?]
export const QUICK: [string, string, boolean][] = [
  ["Add Student", "UserPlus", false], ["Add Staff", "Users", true],
  ["Take Attendance", "Calendar", false], ["Collect Fees", "CreditCard", true],
  ["Give Discount", "Percent", false], ["New Enquiry", "MessageSquare", true],
  ["Kit Order", "ShoppingCart", false], ["Accept Orders", "Package", true],
  ["Dispatch Kits", "Truck", false], ["Send SMS/Email", "Send", true],
  ["Generate Report", "FileText", false], ["Add Branch", "Plus", true],
];
