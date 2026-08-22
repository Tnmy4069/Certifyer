import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const tones = {
  default: "bg-indigo-50 text-indigo-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: keyof typeof tones;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs sm:text-sm text-slate-500">{label}</p>
          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 sm:mt-3 truncate text-[11px] sm:text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md cursor-pointer active:scale-[0.99]">
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
      {content}
    </div>
  );
}
