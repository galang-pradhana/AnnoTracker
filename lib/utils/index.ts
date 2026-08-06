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
