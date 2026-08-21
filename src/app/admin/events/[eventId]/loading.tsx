import { Skeleton } from "@/components/ui/skeleton";

export default function EventSectionLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full bg-slate-200/80" />
        <Skeleton className="h-4 w-96 max-w-full bg-slate-200/70" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-28 shrink-0 rounded-xl bg-slate-200/70" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-3 w-24 bg-slate-200/70" />
            <Skeleton className="mt-4 h-8 w-14 bg-slate-200/80" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="mb-5 h-5 w-44 bg-slate-200/80" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
