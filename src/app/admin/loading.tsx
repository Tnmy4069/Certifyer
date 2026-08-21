import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 bg-slate-200/80" />
          <Skeleton className="h-4 w-80 max-w-full bg-slate-200/70" />
        </div>
        <Skeleton className="hidden h-9 w-28 shrink-0 rounded-lg bg-slate-200/80 sm:block" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-3 w-20 bg-slate-200/70" />
            <Skeleton className="mt-4 h-8 w-16 bg-slate-200/80" />
            <Skeleton className="mt-3 h-3 w-28 bg-slate-200/60" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-5 w-40 bg-slate-200/80" />
          <Skeleton className="h-8 w-24 rounded-lg bg-slate-200/70" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
