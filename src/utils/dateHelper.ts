/**
 * Date & Time Utilities for Malaysia Timezone (Asia/Kuala_Lumpur, UTC+8 / GMT+8)
 * Ensures all system dates and times are accurately formatted in Malaysian Standard Time (MYT).
 */

const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Returns formatted Malaysian date-time string: "YYYY-MM-DD HH:mm"
 * e.g., "2026-08-25 16:30"
 */
export function getMalaysiaDateTime(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) {
    const now = new Date();
    return formatToMalaysiaParts(now, false);
  }
  return formatToMalaysiaParts(date, false);
}

/**
 * Returns formatted Malaysian date-time with seconds: "YYYY-MM-DD HH:mm:ss"
 * e.g., "2026-08-25 16:30:45"
 */
export function getMalaysiaDateTimeFull(dateInput?: Date | string | number | null): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) {
    const now = new Date();
    return formatToMalaysiaParts(now, true);
  }
  return formatToMalaysiaParts(date, true);
}

/**
 * Returns Malaysian Date only string: "YYYY-MM-DD"
 * e.g., "2026-08-25"
 */
export function getMalaysiaDate(dateInput?: Date | string | number | null): string {
  const dt = getMalaysiaDateTime(dateInput);
  return dt.slice(0, 10);
}

/**
 * Returns Malaysian Time only string: "HH:mm"
 * e.g., "16:30"
 */
export function getMalaysiaTime(dateInput?: Date | string | number | null): string {
  const dt = getMalaysiaDateTime(dateInput);
  return dt.slice(11, 16);
}

/**
 * Returns Malaysian formatted display string: "DD/MM/YYYY, HH:mm"
 * e.g., "25/08/2026, 16:30"
 */
export function formatMalaysiaDisplay(dateInput?: Date | string | number | null): string {
  const dt = getMalaysiaDateTime(dateInput);
  if (!dt || dt.length < 16) return '-';
  const [datePart, timePart] = dt.split(' ');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year} ${timePart}`;
}

/**
 * Helper to extract parts in Malaysia timezone accurately
 */
function formatToMalaysiaParts(date: Date, withSeconds: boolean = false): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: MALAYSIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hour = getPart('hour');
    // Fix edge cases where 24 might be output
    if (hour === '24') hour = '00';
    const minute = getPart('minute');

    if (withSeconds) {
      const second = getPart('second');
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    // Fallback: manually offset UTC by +8 hours
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const mytDate = new Date(utcTime + (3600000 * 8));
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = mytDate.getFullYear();
    const m = pad(mytDate.getMonth() + 1);
    const d = pad(mytDate.getDate());
    const h = pad(mytDate.getHours());
    const min = pad(mytDate.getMinutes());
    if (withSeconds) {
      const s = pad(mytDate.getSeconds());
      return `${y}-${m}-${d} ${h}:${min}:${s}`;
    }
    return `${y}-${m}-${d} ${h}:${min}`;
  }
}
