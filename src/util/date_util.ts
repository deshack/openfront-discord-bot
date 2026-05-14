const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
