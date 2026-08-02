// Formats a timestamp in US Eastern time, resolving EST vs EDT automatically
// through the IANA zone. The moment captured is when the user pressed Submit.
// Pure and Date-injectable so daylight-saving boundaries are testable.
export function formatEasternTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some engines emit 24 for midnight
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")} ${get("timeZoneName")}`;
}
