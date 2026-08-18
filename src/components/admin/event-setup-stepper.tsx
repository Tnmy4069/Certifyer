import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const EVENT_SETUP_STEPS = [
  { key: "details", label: "Event details", hint: "Name, date, and organizer" },
  { key: "candidates", label: "Candidates", hint: "Import CSV or add people" },
  { key: "template", label: "Template", hint: "Background and fields" },
  { key: "certificates", label: "Certificates", hint: "Generate and issue" },
] as const;

export type EventSetupStep = (typeof EVENT_SETUP_STEPS)[number]["key"];

export function setupHref(eventId: string, step: EventSetupStep) {
  if (step === "details") return `/admin/events/${eventId}`;
  return `/admin/events/${eventId}/${step}?setup=1`;
}

export function EventSetupStepper({
  eventId,
  current,
}: {
  eventId: string;
  current: EventSetupStep;
}) {
  const currentIndex = EVENT_SETUP_STEPS.findIndex((step) => step.key === current);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Create event</p>
          <p className="text-xs text-slate-500">Details → candidates → template → certificates</p>
        </div>
        <Link href={`/admin/events/${eventId}`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
          Exit setup
        </Link>
      </div>
      <ol className="grid gap-3 sm:grid-cols-4">
        {EVENT_SETUP_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.key}>
              <Link
                href={index === 0 ? `/admin/events/${eventId}` : setupHref(eventId, step.key)}
                className={cn(
                  "flex h-full items-start gap-3 rounded-xl border px-3 py-3 transition",
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    active
                      ? "bg-white text-slate-900"
                      : done
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-500"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span>
                  <span className="block text-sm font-medium">{step.label}</span>
                  <span className={cn("mt-0.5 block text-xs", active ? "text-slate-300" : "opacity-80")}>
                    {step.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
