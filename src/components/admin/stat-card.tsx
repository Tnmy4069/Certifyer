import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
