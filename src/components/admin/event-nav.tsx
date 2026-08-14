"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const tabs = [
  { key: "overview", label: "Overview", suffix: "" },
  { key: "template", label: "Template", suffix: "/template" },
  { key: "candidates", label: "Candidates", suffix: "/candidates" },
  { key: "certificates", label: "Certificates", suffix: "/certificates" },
  { key: "settings", label: "Settings", suffix: "/settings" },
];

export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/admin/events/${eventId}`;

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const active = tab.suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Button key={tab.key} asChild variant={active ? "secondary" : "outline"} size="sm">
            <Link href={href}>{tab.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
