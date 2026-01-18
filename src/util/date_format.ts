export type TimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

export const TimestampStyles = {
  ShortTime: "t",
  LongTime: "T",
  ShortDate: "d",
  LongDate: "D",
  ShortDateTime: "f",
  LongDateTime: "F",
  RelativeTime: "R",
} as const;

export function dateToDiscordTimestamp(
  date: Date,
  style: TimestampStyle,
): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
