import { splitInto24hWindows } from "../src/util/date_util";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("splitInto24hWindows", () => {
  it("returns one window for a range within 24h", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-01T12:00:00.000Z");
    const windows = splitInto24hWindows(start, end);

    expect(windows).toHaveLength(1);
    expect(windows[0].start).toBe(start.toISOString());
    expect(windows[0].end).toBe(end.toISOString());
  });

  it("returns one window for exactly 24h", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date(start.getTime() + MS_PER_DAY);
    const windows = splitInto24hWindows(start, end);

    expect(windows).toHaveLength(1);
    expect(windows[0].start).toBe(start.toISOString());
    expect(windows[0].end).toBe(end.toISOString());
  });

  it("splits a 7-day range into 7 windows", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-08T00:00:00.000Z");
    const windows = splitInto24hWindows(start, end);

    expect(windows).toHaveLength(7);
    expect(windows[0].start).toBe(start.toISOString());
    expect(windows[6].end).toBe(end.toISOString());
  });

  it("each window boundary aligns with the next window start", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-04T06:00:00.000Z");
    const windows = splitInto24hWindows(start, end);

    for (let i = 0; i < windows.length - 1; i++) {
      expect(windows[i].end).toBe(windows[i + 1].start);
    }
  });

  it("last window ends exactly at the original end", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-04T06:30:00.000Z");
    const windows = splitInto24hWindows(start, end);

    expect(windows[windows.length - 1].end).toBe(end.toISOString());
  });

  it("returns empty array when start equals end", () => {
    const t = new Date("2024-01-01T00:00:00.000Z");
    const windows = splitInto24hWindows(t, t);

    expect(windows).toHaveLength(0);
  });
});
