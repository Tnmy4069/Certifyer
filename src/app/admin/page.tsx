import { connectDb } from "@/lib/db";
import { Certificate, Event } from "@/models";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent><p className="text-xs text-muted-foreground">{hint}</p></CardContent> : null}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDb();
  const events = await Event.find({ createdBy: session.user.id }).sort({ createdAt: -1 }).lean();
  const eventIds = events.map((e) => e._id);

  const [issued, failed, downloads, verifications] = await Promise.all([
    Certificate.countDocuments({ eventId: { $in: eventIds }, status: "GENERATED" }),
    Certificate.countDocuments({ eventId: { $in: eventIds }, status: "FAILED" }),
    Certificate.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $group: { _id: null, total: { $sum: "$downloadCount" } } },
    ]),
    Certificate.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $group: { _id: null, total: { $sum: "$verificationCount" } } },
    ]),
  ]);

  const downloadTotal = downloads[0]?.total || 0;
  const verificationTotal = verifications[0]?.total || 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of events and certificate activity.</p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">Create Event</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Events" value={events.length} />
        <StatCard label="Certificates issued" value={issued} />
        <StatCard label="Downloads" value={downloadTotal} />
        <StatCard label="Verifications" value={verificationTotal} />
        <StatCard label="Generation failures" value={failed} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>Recent events and generation status.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState
              title="No events yet"
              description="Create your first event to design templates and issue certificates."
              actionLabel="Create Event"
              actionHref="/admin/events/new"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Event</th>
                    <th className="pb-3 font-medium">Candidates</th>
                    <th className="pb-3 font-medium">Generated</th>
                    <th className="pb-3 font-medium">Downloads</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={String(event._id)} className="border-b last:border-0">
                      <td className="py-3">
                        <Link href={`/admin/events/${event._id}`} className="font-medium hover:underline">
                          {event.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">/{event.slug}</p>
                      </td>
                      <td className="py-3">{event.candidateCount}</td>
                      <td className="py-3">{event.generatedCount}</td>
                      <td className="py-3">{event.downloadCount}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            event.status === "PUBLISHED"
                              ? "success"
                              : event.status === "ARCHIVED"
                                ? "muted"
                                : "outline"
                          }
                        >
                          {event.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{formatShortDate(event.createdAt)}</td>
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
