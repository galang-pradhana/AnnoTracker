/**
 * Returns the "work date" string (YYYY-MM-DD) based on agency rules:
 * A work day starts at 07:00 WIB (UTC+7) and ends at 06:59 WIB the next day.
 * Hours between 00:00–06:59 WIB are counted as the previous work day.
 *
 * @param date - Optional Date object (defaults to now)
 * @returns YYYY-MM-DD string representing the correct work day
 */
export function getWorkDate(date: Date = new Date()): string {
  // WIB = UTC+7, work day cutoff = 07:00 WIB
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const WORK_DAY_START_HOUR = 7;

  // Convert to WIB time
  const wibTime = new Date(date.getTime() + WIB_OFFSET_MS);
  const wibHour = wibTime.getUTCHours();

  // If before 07:00 WIB, treat as the previous work day
  if (wibHour < WORK_DAY_START_HOUR) {
    wibTime.setUTCDate(wibTime.getUTCDate() - 1);
  }

  return wibTime.toISOString().split("T")[0];
}

/**
 * Format duration in seconds into HH:MM:SS or string representation
 */
export function formatSecondsToTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}j ${mins}m ${secs}d`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}d`;
  }
  return `${secs}d`;
}

/**
 * Format decimal hours (e.g. 55.5833) to formatted double detail string:
 * e.g. "55.58 jam - 55j 35m" or "5 jam" if exact integer.
 */
export function formatDecimalHours(
  hours: number,
  options?: { format?: "double" | "compact" | "decimal" | "short" }
): string {
  if (!hours || isNaN(hours) || hours <= 0) return "0 jam";

  const totalMinutes = Math.round(hours * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const decimalVal = Number(hours.toFixed(2));

  // If exact round hours (no leftover minutes)
  if (mins === 0) {
    return `${hrs} jam`;
  }

  const fmt = options?.format || "double";
  const minText = hrs > 0 ? `${hrs}j ${mins}m` : `${mins}m`;

  if (fmt === "decimal") return `${decimalVal} jam`;
  if (fmt === "short") return minText;
  if (fmt === "compact") return `${decimalVal}j · ${minText}`;

  // Default "double": "55.58 jam - 55j 35m" (or "0.64 jam - 38m")
  return `${decimalVal} jam - ${minText}`;
}

/**
 * Format number to Indonesian Rupiah currency
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function padZ(n: number) { return String(n).padStart(2, "0"); }

/**
 * Returns payroll period cutoff (15th month M -> 14th month M+1)
 */
export function getPayrollPeriod(referenceDate: Date = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  if (day >= 15) {
    const endMonth = month === 11 ? 0 : month + 1;
    const endYear  = month === 11 ? year + 1 : year;
    return {
      start: `${year}-${padZ(month + 1)}-15`,
      end:   `${endYear}-${padZ(endMonth + 1)}-14`,
    };
  } else {
    const startMonth = month === 0 ? 11 : month - 1;
    const startYear  = month === 0 ? year - 1 : year;
    return {
      start: `${startYear}-${padZ(startMonth + 1)}-15`,
      end:   `${year}-${padZ(month + 1)}-14`,
    };
  }
}

/**
 * Formats start date (YYYY-MM-DD) and end date (YYYY-MM-DD) to Indonesian label string
 * Example: "15 Agu 2026 — 14 Sep 2026"
 */
export function getPayrollPeriodLabel(start: string, end: string): string {
  const MONTH = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return `${sd} ${MONTH[sm - 1]} ${sy} — ${ed} ${MONTH[em - 1]} ${ey}`;
}
