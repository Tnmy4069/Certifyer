import { connectDb } from "@/lib/db";
import { eventAccessFilter, eventOwnerLabel } from "@/lib/events/helpers";
import { auditActionLabel } from "@/lib/admin/activity";
import { AuditEvent, Candidate, Certificate, Event, Feedback, User } from "@/models";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, Download, ShieldCheck, Star, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { FunnelRows } from "@/components/admin/funnel-rows";
import { RatingBars } from "@/components/admin/rating-bars";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDb();
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const events = await Event.find(eventAccessFilter(session.user.id, session.user.role))
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean();
  const eventIds = events.map((event) => event._id);
  const eventNameById = new Map(events.map((event) => [String(event._id), event.name]));
  const scoped = { eventId: { $in: eventIds } };

  const [
    issued,
    failed,
    pending,
    downloaded,
    verified,
    candidateTotal,
    downloadAgg,
    verificationAgg,
    ratingAgg,
    ratingBuckets,
    recentActivity,
    failedCertificates,
    adminCount,
  ] = await Promise.all([
    eventIds.length ? Certificate.countDocuments({ ...scoped, status: "GENERATED" }) : 0,
    eventIds.length ? Certificate.countDocuments({ ...scoped, status: "FAILED" }) : 0,
    eventIds.length
      ? Certificate.countDocuments({ ...scoped, status: { $in: ["NOT_GENERATED", "PENDING"] } })
      : 0,
    eventIds.length ? Certificate.countDocuments({ ...scoped, downloadCount: { $gt: 0 } }) : 0,
    eventIds.length ? Certificate.countDocuments({ ...scoped, verificationCount: { $gt: 0 } }) : 0,
    eventIds.length ? Candidate.countDocuments(scoped) : 0,
    eventIds.length
      ? Certificate.aggregate([{ $match: scoped }, { $group: { _id: null, total: { $sum: "$downloadCount" } } }])
      : [],
    eventIds.length
      ? Certificate.aggregate([{ $match: scoped }, { $group: { _id: null, total: { $sum: "$verificationCount" } } }])
      : [],
    eventIds.length
      ? Feedback.aggregate([{ $match: scoped }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }])
      : [],
    eventIds.length
      ? Feedback.aggregate([{ $match: scoped }, { $group: { _id: "$rating", count: { $sum: 1 } } }])
      : [],
    eventIds.length
      ? AuditEvent.find(scoped).sort({ createdAt: -1 }).limit(8).lean()
      : [],
    eventIds.length
      ? Certificate.find({ ...scoped, status: "FAILED" }).sort({ updatedAt: -1 }).limit(5).lean()
      : [],
    isSuperAdmin ? User.countDocuments() : 0,
  ]);

  const downloadTotal = downloadAgg[0]?.total || 0;
  const verificationTotal = verificationAgg[0]?.total || 0;
  const feedbackCount = ratingAgg[0]?.count || 0;
  const avgRating = feedbackCount ? Number(ratingAgg[0].avg).toFixed(1) : "—";
  const publishedCount = events.filter((event) => event.status === "PUBLISHED").length;
  const draftCount = events.filter((event) => event.status === "DRAFT").length;
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const bucket of ratingBuckets) {
    const rating = Number(bucket._id);
    if (rating >= 1 && rating <= 5) ratingCounts[rating as 1 | 2 | 3 | 4 | 5] = bucket.count;
  }

  const attention = [
    failed > 0 ? `${failed} certificate${failed === 1 ? "" : "s"} failed generation` : null,
    pending > 0 ? `${pending} certificate${pending === 1 ? "" : "s"} waiting to be generated` : null,
    draftCount > 0 ? `${draftCount} event${draftCount === 1 ? "" : "s"} still in draft` : null,
  ].filter(Boolean) as string[];

  const topEvents = [...events]
    .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0) || (b.generatedCount || 0) - (a.generatedCount || 0))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={
          isSuperAdmin
            ? "Platform overview across every admin's events."
            : "Overview of events, certificates, feedback, and recent activity."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events" value={events.length} hint={`${publishedCount} published`} icon={Award} />
        <StatCard label="Candidates" value={candidateTotal} icon={Users} tone="sky" />
        <StatCard
          label="Certificates issued"
          value={issued}
          hint={pending ? `${pending} pending` : undefined}
          icon={Award}
          tone="success"
        />
        <StatCard label="Downloads" value={downloadTotal} icon={Download} tone="sky" />
        <StatCard label="Verifications" value={verificationTotal} icon={ShieldCheck} />
        <StatCard
          label="Avg rating"
          value={avgRating}
          hint={feedbackCount ? `${feedbackCount} reviews` : "No reviews yet"}
          icon={Star}
          tone="warning"
        />
        <StatCard label="Generation failures" value={failed} icon={XCircle} tone="danger" />
        {isSuperAdmin ? (
          <StatCard label="Admins" value={adminCount} hint="All platform users" icon={Users} />
        ) : (
          <StatCard label="Published events" value={publishedCount} icon={Award} tone="success" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Certificate funnel</CardTitle>
            <CardDescription>How candidates move from import to verification.</CardDescription>
          </CardHeader>
          <CardContent>
            {candidateTotal === 0 ? (
              <p className="text-sm text-muted-foreground">Import candidates to see funnel progress.</p>
            ) : (
              <FunnelRows
                rows={[
                  { label: "Candidates", value: candidateTotal },
                  { label: "Certificates issued", value: issued },
                  { label: "Downloaded", value: downloaded },
                  { label: "Verified", value: verified },
                  { label: "Feedback received", value: feedbackCount },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Items that may be blocking certificate delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {attention.length === 0 && failedCertificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
            ) : (
              <>
                {attention.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <span>{item}</span>
                  </div>
                ))}
                {failedCertificates.length > 0 ? (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent failures</p>
                    {failedCertificates.map((cert) => (
                      <Link
                        key={String(cert._id)}
                        href={`/admin/events/${cert.eventId}/certificates`}
                        className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <p className="font-medium">{cert.certificateNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventNameById.get(String(cert.eventId)) ?? "Event"} · {cert.failureReason || "Generation failed"}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Downloads, lookups, generation, and feedback.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/activity">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((item) => (
                  <li key={String(item._id)} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{auditActionLabel(item.action)}</p>
                      <p className="text-xs text-muted-foreground">
                        {eventNameById.get(String(item.eventId)) ?? "Event"} · {item.actorType}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                Candidate ratings
              </CardTitle>
              <CardDescription>
                {feedbackCount ? `${avgRating} average from ${feedbackCount} reviews.` : "Ratings appear after candidates submit feedback."}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/feedback">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {feedbackCount === 0 ? (
              <p className="text-sm text-muted-foreground">No ratings yet.</p>
            ) : (
              <RatingBars counts={ratingCounts} total={feedbackCount} />
            )}
          </CardContent>
        </Card>
      </div>

      {topEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Top events</CardTitle>
            <CardDescription>Highest download activity first.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {topEvents.map((event, index) => (
                <Link
                  key={String(event._id)}
                  href={`/admin/events/${event._id}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition hover:border-indigo-200 hover:bg-white hover:shadow-sm"
                >
                  <p className="text-xs text-muted-foreground">#{index + 1}</p>
                  <p className="mt-1 truncate font-medium">{event.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.downloadCount || 0} downloads · {event.generatedCount || 0} issued
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            {isSuperAdmin ? "All users' events and generation status." : "Recent events and generation status."}
          </CardDescription>
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
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    {isSuperAdmin ? <th>Owner</th> : null}
                    <th>Candidates</th>
                    <th>Generated</th>
                    <th>Downloads</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={String(event._id)}>
                      <td className="py-3">
                        <Link href={`/admin/events/${event._id}`} className="font-medium hover:underline">
                          {event.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">/{event.slug}</p>
                      </td>
                      {isSuperAdmin ? (
                        <td className="py-3 text-muted-foreground">
                          {eventOwnerLabel(event.createdBy) ?? "Unknown owner"}
                        </td>
                      ) : null}
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
