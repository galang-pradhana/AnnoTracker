export const APP_NAME = "AnnoTracker";
export const APP_DESCRIPTION = "Aplikasi Pencatatan Jam Kerja & Payroll Tim Anotasi Data";

// Retention Policies
export const PROOF_IMAGE_RETENTION_DAYS = 45; // Simpan gambar bukti hingga mid bulan berikutnya (~45 hari)

// Default Tier Fallbacks (jika belum diset owner)
export const DEFAULT_SALARY_TIERS = [
  { min_hours: 0, max_hours: 8, rate_per_hour: 10000 },
  { min_hours: 8.01, max_hours: 10, rate_per_hour: 11000 },
  { min_hours: 10.01, max_hours: null, rate_per_hour: 12000 },
];

// Default Bonus Rule Fallbacks
export const DEFAULT_BONUS_THRESHOLD_HOURS = 40;
export const DEFAULT_BONUS_AMOUNT = 100000;

// App Routes
export const ROUTES = {
  LOGIN: "/login",
  EMPLOYEE_WORK_SESSION: "/work-session",
  EMPLOYEE_MY_EARNINGS: "/my-earnings",
  EMPLOYEE_HISTORY: "/history",
  EMPLOYEE_PROFILE: "/profile",
  EMPLOYEE_ASSESSMENT: "/employee-assessment",
  OWNER_DASHBOARD: "/dashboard",
  OWNER_CALENDAR: "/calendar",
  OWNER_PAYROLL: "/payroll",
  OWNER_MASTER_DATA: "/master-data",
  OWNER_USERS: "/users",
  OWNER_ASSESSMENT: "/assessment",
  OWNER_SETTINGS: "/settings",
  OWNER_SOURCE: "/source",
  EMPLOYEE_SOURCE: "/employee-source",
} as const;
