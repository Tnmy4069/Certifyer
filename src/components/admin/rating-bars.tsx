import { Star } from "lucide-react";

export function RatingBars({
  counts,
  total,
}: {
  counts: Record<number, number>;
  total: number;
}) {
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = counts[rating] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={rating} className="flex items-center gap-3 text-sm">
            <span className="flex w-10 items-center gap-1 text-muted-foreground">
              {rating}
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-14 text-right text-xs text-muted-foreground">
              {count} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
