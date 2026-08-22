"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  ScrollText,
  Users,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminNavLinks, isAdminNavActive } from "@/components/admin/sidebar";

export function AdminMobileHeader({
  userName,
  role,
}: {
  userName?: string | null;
  role?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const links = getAdminNavLinks(role);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const initials = (userName || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-slate-700 hover:bg-slate-100"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/30">
              C
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">Certify</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="h-8 rounded-lg bg-indigo-600 px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">
            <Link href="/admin/events/new">
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Link>
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials}
          </div>
        </div>
      </div>

      {/* Horizontal navigation pills */}
      <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 pt-0.5 no-scrollbar">
        {links.map((link) => {
          const active = isAdminNavActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active ? "text-indigo-300" : "text-slate-500")} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer Portal */}
      {drawerOpen && mounted && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex h-screen w-screen overflow-hidden">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
                onClick={() => setDrawerOpen(false)}
              />

              {/* Drawer Content */}
              <div className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-[#0b1220] p-5 text-slate-200 shadow-2xl animate-in slide-in-from-left duration-200 z-10">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-sm font-bold text-white shadow-lg shadow-indigo-900/40">
                      C
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Certify</p>
                      <p className="text-xs text-slate-400">Admin workspace</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Navigation links */}
                <div className="flex-1 space-y-6 overflow-y-auto py-5 no-scrollbar">
                  <Button asChild className="w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-900/30" size="sm">
                    <Link href="/admin/events/new" onClick={() => setDrawerOpen(false)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Create New Event
                    </Link>
                  </Button>

                  <div className="space-y-1">
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace</p>
                    <Link
                      href="/admin"
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        pathname === "/admin"
                          ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4 text-indigo-400" />
                      Dashboard
                    </Link>
                    <Link
                      href="/admin/events"
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        pathname.startsWith("/admin/events")
                          ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <Award className="h-4 w-4 text-indigo-400" />
                      Events
                    </Link>
                  </div>

                  <div className="space-y-1">
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Insights</p>
                    <Link
                      href="/admin/feedback"
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        pathname.startsWith("/admin/feedback")
                          ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <MessageSquareText className="h-4 w-4 text-amber-400" />
                      Feedback
                    </Link>
                    <Link
                      href="/admin/activity"
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        pathname.startsWith("/admin/activity")
                          ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <ScrollText className="h-4 w-4 text-emerald-400" />
                      Activity
                    </Link>
                  </div>

                  {role === "SUPER_ADMIN" ? (
                    <div className="space-y-1">
                      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Manage</p>
                      <Link
                        href="/admin/users"
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          pathname.startsWith("/admin/users")
                            ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        )}
                      >
                        <Users className="h-4 w-4 text-sky-400" />
                        Users
                      </Link>
                    </div>
                  ) : null}
                </div>

                {/* User profile & Logout */}
                <div className="border-t border-white/10 pt-4 space-y-3 shrink-0">
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{userName || "Admin"}</p>
                      <p className="text-xs text-slate-400">{role === "SUPER_ADMIN" ? "Super admin" : "Administrator"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      aria-label="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
