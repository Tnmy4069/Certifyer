import Link from "next/link";

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export function FunnelRows({
  rows,
}: {
  rows: { label: string; value: number; href?: string }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = percent(row.value, max);
        
        const content = (
          <>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>{row.label}</span>
              <span className="text-muted-foreground">
                {row.value} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        );

        return (
          <div key={row.label}>
            {row.href ? (
              <Link href={row.href} className="block transition-opacity hover:opacity-80">
                {content}
              </Link>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
