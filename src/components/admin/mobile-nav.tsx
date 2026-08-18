"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminNavLinks, isAdminNavActive } from "@/components/admin/sidebar";
import { cn } from "@/lib/utils";

export function AdminMobileNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const links = getAdminNavLinks(role);

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-px">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
            isAdminNavActive(pathname, link.href)
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
