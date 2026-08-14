"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, LayoutDashboard, LogOut, Plus, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Award },
];

export function AdminSidebar({
  userName,
  role,
}: {
  userName?: string | null;
  role?: string;
}) {
  const pathname = usePathname();
  const visibleLinks =
    role === "SUPER_ADMIN"
      ? [...links, { href: "/admin/users", label: "Users", icon: Users }]
      : links;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          C
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Certify</p>
          <p className="text-xs text-muted-foreground">Certificate Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleLinks.map((link) => {
          const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t p-4">
        <Button asChild className="w-full" size="sm">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4" />
            New Event
          </Link>
        </Button>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName || "Admin"}</p>
            <p className="text-xs text-muted-foreground">
              {role === "SUPER_ADMIN" ? "Super Administrator" : "Administrator"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
