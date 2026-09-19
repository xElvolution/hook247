import Link from "next/link";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "good" | "warn" | "brand";
  href?: string;
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-good",
    warn: "text-amber-400",
    brand: "text-brand-2",
  }[tone];

  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-1.5 font-display text-2xl font-bold ${toneClass}`}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </>
  );

  const base =
    "rounded-xl border border-line bg-card px-4 py-3.5 block transition";

  return href ? (
    <Link href={href} className={`${base} hover:border-brand/40`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "good" | "warn" | "bad" | "brand";
}) {
  const cls = {
    muted: "bg-white/8 text-muted",
    good: "bg-good/15 text-good",
    warn: "bg-amber-400/15 text-amber-300",
    bad: "bg-red-500/15 text-red-300",
    brand: "bg-brand/15 text-brand-2",
  }[tone];
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-muted">{children}</p>
  );
}

/**
 * Minimal bar chart. Deliberately CSS-only — a charting dependency would be
 * the heaviest thing in the bundle for six bars behind a password.
 */
export function Bars({
  data,
  format,
}: {
  data: { day: Date; value: number }[];
  format: (v: number) => string;
}) {
  if (data.length === 0) return <Empty>No activity in this period.</Empty>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d) => (
        <div
          key={d.day.toISOString()}
          className="group relative flex-1"
          style={{ height: "100%" }}
        >
          <div className="flex h-full flex-col justify-end">
            <div
              className="rounded-t bg-brand/70 transition group-hover:bg-brand"
              style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
            />
          </div>
          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface px-1.5 py-0.5 text-[10px] text-ink group-hover:block">
            {d.day.toLocaleDateString("en-NG", {
              month: "short",
              day: "numeric",
            })}
            : {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
