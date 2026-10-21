/**
 * Time Utilities for Time Travel Database System
 * Bridges local browser time (HTML5 datetime-local) and Oracle ISO-8601 UTC timestamps.
 */

export function toLocalDateTimeInputValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function localInputToIsoUtc(localInputString) {
  if (!localInputString) return new Date().toISOString();
  // Parsing a local "YYYY-MM-DDTHH:mm" in browser local timezone
  const date = new Date(localInputString);
  return date.toISOString();
}

export function getLocalOffsetTimeString(minutesAgo = 0) {
  const target = new Date(Date.now() - minutesAgo * 60 * 1000);
  return toLocalDateTimeInputValue(target);
}

export function formatFriendlyDateTime(isoOrDateString) {
  if (!isoOrDateString) return 'N/A';
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return String(isoOrDateString);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(isoOrDateString);
  }
}
