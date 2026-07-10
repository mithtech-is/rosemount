#!/bin/bash
cd ~/frappe-bench/apps/rosemount_dashboard/dashboard-ui/node_modules/@deemlol/next-icons
for n in Building Building2 Home Users User Briefcase GraduationCap Award Wallet \
         CreditCard DollarSign Dollar Receipt Tag CalendarCheck Calendar Megaphone \
         Speaker Radio LayoutDashboard LayoutGrid Grid Layout Package PackageCheck \
         Truck FileText FileSpreadsheet File Percent Send UserPlus ShoppingCart \
         BookOpen Book Mail Email BarChart BarChart2 PieChart Settings Bell Search \
         ChevronDown ChevronRight Plus Eye Edit Edit2 Trash Trash2 RotateCcw Filter \
         Download Lock Shield X CheckCircle XCircle Clipboard ClipboardCheck Menu Globe Key; do
  if grep -q "as ${n} " build/index.d.ts; then echo "YES ${n}"; fi
done
