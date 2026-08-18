"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  Award,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Users,
} from "lucide-react";

const tabs = [
  { key: "overview", label: "Overview", suffix: "", icon: LayoutDashboard },
  { key: "candidates", label: "Candidates", suffix: "/candidates", icon: Users },
  { key: "template", label: "Template", suffix: "/template", icon: FileText },
  { key: "certificates", label: "Certificates", suffix: "/certificates", icon: Award },
  { key: "settings", label: "Settings", suffix: "/settings", icon: Settings },
  { key: "feedback", label: "Feedback", suffix: "/feedback", icon: MessageSquareText },
  { key: "activity", label: "Activity", suffix: "/activity", icon: Activity },
];

export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/admin/events/${eventId}`;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {tabs.map((tab) => {
          const href = `${base}${tab.suffix}`;
          const active = tab.suffix === "" ? pathname === base : pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "inline-flex min-w-max items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
