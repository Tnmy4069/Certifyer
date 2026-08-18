"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Plus,
  ScrollText,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const workspaceLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Award },
];

const insightLinks = [
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/admin/activity", label: "Activity", icon: ScrollText },
];

export function getAdminNavLinks(role?: string) {
  const links = [...workspaceLinks, ...insightLinks];
  return role === "SUPER_ADMIN" ? [...links, { href: "/admin/users", label: "Users", icon: Users }] : links;
}

export function isAdminNavActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

function NavSection({
  label,
  links,
  pathname,
}: {
  label: string;
  links: typeof workspaceLinks;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      {links.map((link) => {
        const active = isAdminNavActive(pathname, link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-indigo-300" : "text-slate-500")} />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminSidebar({
  userName,
  role,
}: {
  userName?: string | null;
  role?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col bg-[#0b1220] text-slate-200">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-sm font-bold text-white shadow-lg shadow-indigo-900/40">
          C
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">Certify</p>
          <p className="text-xs text-slate-400">Admin workspace</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <NavSection label="Workspace" links={workspaceLinks} pathname={pathname} />
        <NavSection label="Insights" links={insightLinks} pathname={pathname} />
        {role === "SUPER_ADMIN" ? (
          <NavSection
            label="Manage"
            links={[{ href: "/admin/users", label: "Users", icon: Users }]}
            pathname={pathname}
          />
        ) : null}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        <Button asChild className="w-full rounded-xl bg-indigo-500 text-white hover:bg-indigo-400" size="sm">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4" />
            New event
          </Link>
        </Button>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName || "Admin"}</p>
            <p className="text-xs text-slate-400">{role === "SUPER_ADMIN" ? "Super administrator" : "Administrator"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
