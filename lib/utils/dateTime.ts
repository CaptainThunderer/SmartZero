/**
 * Date & Time Utilities for Admin Contest Scheduling & Server Authority.
 *
 * Designed to handle local browser datetime-local inputs, robust timezone formatting,
 * dynamic auto end-time calculations, and unambiguous ISO conversions for PostgreSQL timestamptz.
 */

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * Formats a Date object into a 'YYYY-MM-DDTHH:mm' string in the local timezone.
 * Uses local getters (getFullYear, getMonth, getDate, getHours, getMinutes)
 * to avoid UTC offset discrepancies (e.g. IST +5:30 shifting dates to previous day).
 */
export function formatLocalDatetime(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns the current instant formatted as a local 'YYYY-MM-DDTHH:mm' string.
 * Never hardcodes any historical or static development date.
 */
export function getCurrentLocalDatetime(): string {
  return formatLocalDatetime(new Date());
}

/**
 * Adds a specified number of minutes to a local datetime string ('YYYY-MM-DDTHH:mm')
 * and returns the resulting local datetime string. Correctly handles hour, day,
 * month, and year rollovers.
 */
export function addMinutesToLocalDatetime(localStr: string, minutesToAdd: number): string {
  if (!localStr || !localStr.includes("T")) return "";
  const [datePart, timePart] = localStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  // Construct Date in local timezone
  const date = new Date(year, month - 1, day, hours, minutes + Number(minutesToAdd), 0);
  return formatLocalDatetime(date);
}

/**
 * Converts a local 'YYYY-MM-DDTHH:mm' string into an unambiguous UTC ISO-8601 string
 * suitable for PostgreSQL timestamptz storage.
 */
export function localDatetimeToIso(localStr: string): string {
  if (!localStr) return "";
  if (!localStr.includes("T")) return new Date(localStr).toISOString();

  const [datePart, timePart] = localStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  const localDate = new Date(year, month - 1, day, hours, minutes, 0);
  return localDate.toISOString();
}

/**
 * Converts a UTC ISO-8601 string (e.g. from Supabase timestamptz) back to
 * a local 'YYYY-MM-DDTHH:mm' string suitable for datetime-local inputs.
 */
export function isoToLocalDatetime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return formatLocalDatetime(date);
}

/**
 * Validates whether end_at is strictly after start_at and duration is positive.
 */
export function validateContestSchedule(
  startLocal: string,
  endLocal: string,
  durationMinutes: number
): {
  valid: boolean;
  error?: string;
} {
  if (!startLocal || !endLocal) {
    return { valid: false, error: "Start time and end time are required." };
  }

  const startIso = localDatetimeToIso(startLocal);
  const endIso = localDatetimeToIso(endLocal);

  const startTime = new Date(startIso).getTime();
  const endTime = new Date(endIso).getTime();

  if (isNaN(startTime) || isNaN(endTime)) {
    return { valid: false, error: "Invalid date format." };
  }

  if (endTime <= startTime) {
    return { valid: false, error: "End time must be strictly after start time." };
  }

  if (durationMinutes <= 0 || isNaN(durationMinutes)) {
    return { valid: false, error: "Duration must be a positive number of minutes." };
  }

  return { valid: true };
}
