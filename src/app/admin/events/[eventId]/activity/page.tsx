import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { AUDIT_ACTION_FILTERS, auditActionLabel } from "@/lib/admin/activity";
import { AuditEvent } from "@/models";
import { EventNav } from "@/components/admin/event-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

type Params = { params: Promise<{ eventId: string }>; searchParams: Promise<{ action?: string }> };

export default async function EventActivityPage({ params, searchParams }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { eventId } = await params;
  const { action } = await searchParams;

  await connectDb();
  try {
    await getOwnedEvent(eventId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const filter: Record<string, unknown> = { eventId };
  if (action) filter.action = action;
  const activity = await AuditEvent.find(filter).sort({ createdAt: -1 }).limit(200).lean();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Portal lookups, downloads, verifications, and admin actions for this event.
        </p>
      </div>
      <EventNav eventId={eventId} />

      <div className="flex flex-wrap gap-2">
        {AUDIT_ACTION_FILTERS.map((item) => {
          const href = item.value
            ? `/admin/events/${eventId}/activity?action=${encodeURIComponent(item.value)}`
            : `/admin/events/${eventId}/activity`;
          const active = (action || "") === item.value;
          return (
            <Link
              key={item.label}
              href={href}
              className={active ? "admin-chip admin-chip-active" : "admin-chip"}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event audit log</CardTitle>
          <CardDescription>{activity.length} recent records.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Activity appears when candidates search, download, verify, or leave feedback."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">When</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item) => (
                    <tr key={String(item._id)} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                      <td className="py-3 font-medium">{auditActionLabel(item.action)}</td>
                      <td className="py-3">
                        <Badge variant="outline">{item.actorType}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
