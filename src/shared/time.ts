/**
 * Reading stored times, shared by the server and the browser (BR11.6).
 * A time written as the database's date-time text ("2026-11-08 10:15:30", UTC, no zone marker) and a
 * time written as ISO 8601 text are both read as UTC instants. No Node-only code lives here.
 */
export function parseStoredTime(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  // "YYYY-MM-DD HH:MM:SS[.fff]" with no zone marker is UTC, not local time.
  const sqlite = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(text);
  const iso = sqlite ? `${sqlite[1]}T${sqlite[2]}Z` : text;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
