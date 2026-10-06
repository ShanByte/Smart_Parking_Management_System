/**
 * Strips user-facing demo indicators such as "[Demo]", "(Demo)", "Demo"
 * from parking lot names for clean consumer presentation.
 */
export function formatLotName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/\s*\[\s*demo\s*\]/gi, '')
    .replace(/\s*\(\s*demo\s*\)/gi, '')
    .replace(/\s+demo$/gi, '')
    .trim();
}

/**
 * Formats a Date into local YYYY-MM-DDTHH:mm string suitable for HTML5 datetime-local inputs.
 */
export function formatToDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats arrival datetime into a readable label (e.g., "3:10 PM" or "Oct 7, 3:10 PM").
 */
export function formatArrivalLabel(date: Date): string {
  if (isNaN(date.getTime())) return '';
  const isToday = date.toDateString() === new Date().toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) {
    return timeStr;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}
