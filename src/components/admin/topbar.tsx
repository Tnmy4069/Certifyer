"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

function crumbsFor(pathname: string) {
  if (pathname === "/admin") return [{ label: "Dashboard" }];
  if (pathname.startsWith("/admin/events/new")) {
    return [
      { label: "Events", href: "/admin/events" },
      { label: "New event" },
    ];
  }
  if (pathname.match(/^\/admin\/events\/[^/]+/)) {
    const rest = pathname.replace(/^\/admin\/events\/[^/]+/, "");
    const section =
      rest === "/template"
        ? "Template"
        : rest === "/candidates"
          ? "Candidates"
          : rest === "/certificates"
            ? "Certificates"
            : rest === "/settings"
              ? "Settings"
              : rest === "/feedback"
                ? "Feedback"
                : rest === "/activity"
                  ? "Activity"
                  : "Overview";
    return [
      { label: "Events", href: "/admin/events" },
      { label: section },
    ];
  }
  if (pathname.startsWith("/admin/events")) return [{ label: "Events" }];
  if (pathname.startsWith("/admin/feedback")) return [{ label: "Feedback" }];
  if (pathname.startsWith("/admin/activity")) return [{ label: "Activity" }];
  if (pathname.startsWith("/admin/users")) return [{ label: "Users" }];
  return [{ label: "Admin" }];
}

export function AdminTopbar({ userName, role }: { userName?: string | null; role?: string }) {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname);
  const initials = (userName || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 hidden border-b border-slate-200/80 bg-white/80 px-8 py-3 backdrop-blur-md md:flex md:items-center md:justify-between">
      <nav className="flex min-w-0 items-center gap-1 text-sm text-slate-500">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-slate-900">
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <Button asChild size="sm" className="rounded-xl">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4" />
            New event
          </Link>
        </Button>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="max-w-[140px] truncate text-xs font-medium text-slate-900">{userName || "Admin"}</p>
            <p className="text-[11px] text-slate-500">{role === "SUPER_ADMIN" ? "Super admin" : "Admin"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
