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
 * Format decimal hours (e.g. 6.5) to formatted string (6j 30m)
 */
export function formatDecimalHours(hours: number): string {
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  if (hrs > 0 && mins > 0) return `${hrs}j ${mins}m`;
  if (hrs > 0) return `${hrs}j`;
  return `${mins}m`;
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
