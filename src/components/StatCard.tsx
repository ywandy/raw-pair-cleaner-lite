interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "blue" | "green" | "orange" | "red" | "purple";
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  blue: "text-[var(--color-accent-blue)]",
  green: "text-[var(--color-primary)]",
  orange: "text-[var(--color-warning-strong)]",
  red: "text-[var(--color-danger)]",
  purple: "text-[var(--color-primary-strong)]"
};

export function StatCard({ label, value, helper, tone = "blue" }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 shadow-[var(--shadow-panel)]">
      <div className="type-ui text-[var(--color-muted)]">{label}</div>
      <div className={`type-stat mt-3 ${TONE_CLASS[tone]}`}>{value}</div>
      {helper && <div className="type-caption mt-2 text-[var(--color-subtle)]">{helper}</div>}
    </div>
  );
}
