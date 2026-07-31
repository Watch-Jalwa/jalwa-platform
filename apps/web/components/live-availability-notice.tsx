import type { LiveAvailability } from "@/lib/live-sources/registry";

const LABELS: Record<LiveAvailability, string> = {
  healthy: "Live",
  degraded: "Degraded",
  off_air: "Off air",
  unavailable: "Unavailable",
};

export function LiveAvailabilityNotice({ availability, message, checkedAt }: {
  availability: LiveAvailability;
  message?: string | null;
  checkedAt?: string | null;
}) {
  const checked = checkedAt ? new Date(checkedAt) : null;
  const checkedLabel = checked && !Number.isNaN(checked.getTime())
    ? checked.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" })
    : null;
  return <div className={`live-availability live-availability-${availability}`} role="status">
    <strong>{LABELS[availability]}</strong>
    {message ? <span>{message}</span> : null}
    {checkedLabel ? <small>Checked {checkedLabel} PKT</small> : null}
  </div>;
}
