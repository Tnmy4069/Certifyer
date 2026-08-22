import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { getOwnedEvent, serializeEvent, eventOwnerLabel } from "@/lib/events/helpers";
import { CertificateTemplate, Certificate, Feedback } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { EventActions } from "@/components/admin/event-actions";
import { EventNav } from "@/components/admin/event-nav";
import { Star } from "lucide-react";
import Link from "next/link";

type Params = { params: Promise<{ eventId: string }> };

export default async function EventDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { eventId } = await params;

  await connectDb();
  let event;
  try {
    event = await getOwnedEvent(eventId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const [template, certificates, feedbacks] = await Promise.all([
    CertificateTemplate.findOne({ eventId: event._id }).lean(),
    Certificate.find({ eventId: event._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Feedback.find({ eventId: event._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  // event.candidateCount is kept in sync by the import API — no extra query needed
  const candidateCount = event.candidateCount;

  const avgRating = feedbacks.length
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
    : "0.0";

  const serialized = serializeEvent(event);
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : undefined;
  const publicUrl = absoluteUrl(`/public/${event.slug}`, origin);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
              <Badge variant={event.status === "PUBLISHED" ? "success" : "outline"}>{event.status}</Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {event.organizerName} · {formatDate(event.eventDate)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            {session.user.role === "SUPER_ADMIN" ? (
              <p className="mt-1 text-xs text-slate-500">
                Created by {eventOwnerLabel(event.createdBy) ?? "Unknown owner"}
              </p>
            ) : null}
          </div>
          <EventActions eventId={String(event._id)} status={event.status} publicUrl={publicUrl} />
        </div>
      </div>

      <EventNav eventId={eventId} />

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <Card className="p-3 sm:p-6">
          <CardHeader className="p-0 sm:p-6 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">Candidates</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{candidateCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-3 sm:p-6">
          <CardHeader className="p-0 sm:p-6 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">Generated</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{serialized.generatedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-3 sm:p-6">
          <CardHeader className="p-0 sm:p-6 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">Downloads</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{serialized.downloadCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-3 sm:p-6">
          <CardHeader className="p-0 sm:p-6 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">Verifications</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{serialized.verificationCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="p-3 sm:p-6 col-span-2 sm:col-span-1">
          <CardHeader className="p-0 sm:p-6 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">Avg Rating ({feedbacks.length})</CardDescription>
            <CardTitle className="flex items-center gap-1.5 text-lg sm:text-2xl text-amber-500">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-amber-400 text-amber-400" />
              {avgRating} <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
            <CardDescription>Complete these steps to publish certificates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Step done={true} label="Event details" href={`/admin/events/${eventId}/settings`} />
            <Step done={candidateCount > 0} label="Import candidates" href={`/admin/events/${eventId}/candidates`} />
            <Step done={Boolean(template)} label="Upload certificate background" href={`/admin/events/${eventId}/template`} />
            <Step
              done={Boolean(template?.configuration?.fields?.length)}
              label="Design template fields"
              href={`/admin/events/${eventId}/template`}
            />
            <Step
              done={serialized.generatedCount > 0}
              label="Generate certificates"
              href={`/admin/events/${eventId}/certificates`}
            />
            <Step done={event.status === "PUBLISHED"} label="Publish event" href={`/admin/events/${eventId}/settings`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent certificates</CardTitle>
            <CardDescription>Latest generated or pending certificates.</CardDescription>
          </CardHeader>
          <CardContent>
            {certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certificates yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {certificates.map((cert) => (
                  <li key={String(cert._id)} className="flex items-center justify-between gap-3">
                    <span className="font-medium">{cert.certificateNumber}</span>
                    <Badge
                      variant={
                        cert.status === "GENERATED"
                          ? "success"
                          : cert.status === "FAILED"
                            ? "destructive"
                            : cert.status === "REVOKED"
                              ? "warning"
                              : "outline"
                      }
                    >
                      {cert.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Candidate Ratings & Remarks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              Candidate Ratings &amp; Remarks
            </CardTitle>
            <CardDescription>
              Feedback submitted by candidates before downloading their certificates.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {feedbacks.length} {feedbacks.length === 1 ? "Review" : "Reviews"}
            </Badge>
            <Link href={`/admin/events/${eventId}/feedback`} className="text-sm text-muted-foreground hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No ratings or feedback received yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {feedbacks.map((fb) => (
                <div
                  key={String(fb._id)}
                  className="rounded-xl border bg-muted/20 p-4 space-y-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < fb.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(fb.createdAt)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-xs">{fb.candidateName}</p>
                    <p className="text-[11px] text-muted-foreground">{fb.candidateEmail}</p>
                  </div>
                  {fb.remark ? (
                    <p className="text-xs text-foreground/90 italic bg-background/60 p-2 rounded-md border border-border/50">
                      &ldquo;{fb.remark}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">No remark provided.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
          done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <span>{label}</span>
    </Link>
  );
}
