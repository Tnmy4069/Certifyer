import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { eventAccessFilter } from "@/lib/events/helpers";
import { AUDIT_ACTION_FILTERS, auditActionLabel } from "@/lib/admin/activity";
import { AuditEvent, Event } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";

type SearchParams = { searchParams: Promise<{ action?: string }> };

export default async function ActivityPage({ searchParams }: SearchParams) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { action } = await searchParams;

  await connectDb();
  const events = await Event.find(eventAccessFilter(session.user.id, session.user.role))
    .select("name")
    .lean();
  const eventIds = events.map((event) => event._id);
  const eventNameById = new Map(events.map((event) => [String(event._id), event.name]));

  const filter: Record<string, unknown> = { eventId: { $in: eventIds } };
  if (action) filter.action = action;

  const activity = eventIds.length
    ? await AuditEvent.find(filter).sort({ createdAt: -1 }).limit(150).lean()
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Lookups, downloads, verifications, generation, and feedback across your events."
      />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
        {AUDIT_ACTION_FILTERS.map((item) => {
          const href = item.value ? `/admin/activity?action=${encodeURIComponent(item.value)}` : "/admin/activity";
          const active = (action || "") === item.value;
          return (
            <Link
              key={item.label}
              href={href}
              className={active ? "admin-chip admin-chip-active shrink-0" : "admin-chip shrink-0"}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            {activity.length} recent {activity.length === 1 ? "event" : "events"}
            {action ? ` · ${auditActionLabel(action)}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Activity appears when candidates search, download, verify, or leave feedback."
            />
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="space-y-3 md:hidden">
                {activity.map((item) => (
                  <div key={String(item._id)} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{auditActionLabel(item.action)}</p>
                        <p className="text-xs text-slate-500">{eventNameById.get(String(item.eventId)) ?? "Global"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {item.actorType}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 border-t pt-2">
                      <span className="font-mono text-[11px]">{item.action}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Action</th>
                      <th>Event</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={String(item._id)}>
                        <td className="py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                        <td className="py-3">
                          <p className="font-medium">{auditActionLabel(item.action)}</p>
                          <p className="text-xs text-muted-foreground">{item.action}</p>
                        </td>
                        <td className="py-3">
                          {item.eventId ? (
                            <Link href={`/admin/events/${item.eventId}`} className="hover:underline">
                              {eventNameById.get(String(item.eventId)) ?? "Event"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3">
                          <Badge variant="outline">{item.actorType}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
