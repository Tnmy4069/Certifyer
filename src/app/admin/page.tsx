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
    certFacet,
    downloaded,
    verified,
    candidateTotal,
    downloadAgg,
    verificationAgg,
    feedbackFacet,
    recentActivity,
    failedCertificates,
    adminCount,
  ] = await Promise.all([
    // Single $facet replaces 5 separate Certificate.countDocuments calls
    eventIds.length
      ? Certificate.aggregate([
          { $match: { eventId: { $in: eventIds } } },
          {
            $facet: {
              issued: [{ $match: { status: "GENERATED" } }, { $count: "n" }],
              failed: [{ $match: { status: "FAILED" } }, { $count: "n" }],
              pending: [{ $match: { status: { $in: ["NOT_GENERATED", "PENDING"] } } }, { $count: "n" }],
            },
          },
        ])
      : [{ issued: [], failed: [], pending: [] }],
    eventIds.length ? Certificate.countDocuments({ ...scoped, downloadCount: { $gt: 0 } }) : 0,
    eventIds.length ? Certificate.countDocuments({ ...scoped, verificationCount: { $gt: 0 } }) : 0,
    eventIds.length ? Candidate.countDocuments(scoped) : 0,
    eventIds.length
      ? Certificate.aggregate([{ $match: scoped }, { $group: { _id: null, total: { $sum: "$downloadCount" } } }])
      : [],
    eventIds.length
      ? Certificate.aggregate([{ $match: scoped }, { $group: { _id: null, total: { $sum: "$verificationCount" } } }])
      : [],
    // Single $facet replaces 2 separate Feedback aggregates
    eventIds.length
      ? Feedback.aggregate([
          { $match: scoped },
          {
            $facet: {
              stats: [{ $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }],
              buckets: [{ $group: { _id: "$rating", count: { $sum: 1 } } }],
            },
          },
        ])
      : [{ stats: [], buckets: [] }],
    eventIds.length
      ? AuditEvent.find(scoped).sort({ createdAt: -1 }).limit(8).lean()
      : [],
    eventIds.length
      ? Certificate.find({ ...scoped, status: "FAILED" }).sort({ updatedAt: -1 }).limit(5).lean()
      : [],
    isSuperAdmin ? User.countDocuments() : 0,
  ]);

  const cf = certFacet[0] ?? { issued: [], failed: [], pending: [] };
  const issued = cf.issued[0]?.n ?? 0;
  const failed = cf.failed[0]?.n ?? 0;
  const pending = cf.pending[0]?.n ?? 0;

  const ff = feedbackFacet[0] ?? { stats: [], buckets: [] };
  const ratingAgg = ff.stats;
  const ratingBuckets = ff.buckets;

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

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard href="#events" label="Events" value={events.length} hint={`${publishedCount} published`} icon={Award} />
        <StatCard href="#events" label="Candidates" value={candidateTotal} icon={Users} tone="sky" />
        <StatCard
          href="#events"
          label="Certificates issued"
          value={issued}
          hint={pending ? `${pending} pending` : undefined}
          icon={Award}
          tone="success"
        />
        <StatCard href="/admin/activity" label="Downloads" value={downloadTotal} icon={Download} tone="sky" />
        <StatCard href="/admin/activity" label="Verifications" value={verificationTotal} icon={ShieldCheck} />
        <StatCard
          href="/admin/feedback"
          label="Avg rating"
          value={avgRating}
          hint={feedbackCount ? `${feedbackCount} reviews` : "No reviews yet"}
          icon={Star}
          tone="warning"
        />
        <StatCard href="#events" label="Generation failures" value={failed} icon={XCircle} tone="danger" />
        {isSuperAdmin ? (
          <StatCard href="/admin/users" label="Admins" value={adminCount} hint="All platform users" icon={Users} />
        ) : (
          <StatCard href="#events" label="Published events" value={publishedCount} icon={Award} tone="success" />
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
                  { label: "Candidates", value: candidateTotal, href: "#events" },
                  { label: "Certificates issued", value: issued, href: "#events" },
                  { label: "Downloaded", value: downloaded, href: "/admin/activity" },
                  { label: "Verified", value: verified, href: "/admin/activity" },
                  { label: "Feedback received", value: feedbackCount, href: "/admin/feedback" },
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
                        className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
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
              <CardTitle>Recent feedback</CardTitle>
              <CardDescription>Latest candidate ratings and remarks.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/feedback">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {feedbackCount === 0 ? (
              <p className="text-sm text-muted-foreground">No feedback ratings yet.</p>
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

      <Card id="events">
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
            <>
              {/* Mobile Event Cards (< md) */}
              <div className="space-y-3 md:hidden">
                {events.map((event) => (
                  <Link
                    key={String(event._id)}
                    href={`/admin/events/${event._id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{event.name}</p>
                        <p className="text-xs text-muted-foreground">/{event.slug}</p>
                      </div>
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
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs text-slate-500">
                      <span>{event.candidateCount} candidates</span>
                      <span>{event.generatedCount} issued</span>
                      <span>{event.downloadCount} dl</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
