// UI Currency and Date Formatting Helpers (UI Rendering Edge Only)

/**
 * Formats an integer amount of USD cents into a standard currency string (e.g. 1500 -> "$15.00").
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Formats a short price tag without trailing zeros when even (e.g. 1500 -> "$15", 1550 -> "$15.50").
 */
export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100;
  if (cents % 100 === 0) {
    return `$${dollars}`;
  }
  return formatCents(cents);
}
