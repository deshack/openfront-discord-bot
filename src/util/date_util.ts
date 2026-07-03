const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) {
    return false;
  }

  const date = new Date(`${dateStr}T00:00:00Z`);

  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

export function splitInto24hWindows(
  start: Date,
  end: Date,
): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  let cursor = start.getTime();
  const endMs = end.getTime();

  while (cursor < endMs) {
    const windowEnd = Math.min(cursor + MS_PER_DAY, endMs);
    windows.push({
      start: new Date(cursor).toISOString(),
      end: new Date(windowEnd).toISOString(),
    });
    cursor = windowEnd;
  }

  return windows;
}
