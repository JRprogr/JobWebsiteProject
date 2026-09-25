export function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 45) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

// "25 SEP 14:02 UTC" for the footer stamp
export function utcStamp(iso: string): string {
  const d = new Date(iso);
  const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getUTCMonth()];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())} ${month} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
