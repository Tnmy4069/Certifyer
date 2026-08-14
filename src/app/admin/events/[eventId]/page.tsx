import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { getOwnedEvent, serializeEvent } from "@/lib/events/helpers";
import { CertificateTemplate, Candidate, Certificate } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { EventActions } from "@/components/admin/event-actions";
import { EventNav } from "@/components/admin/event-nav";
import Link from "next/link";

type Params = { params: Promise<{ eventId: string }> };

export default async function EventDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { eventId } = await params;

  await connectDb();
  let event;
  try {
    event = await getOwnedEvent(eventId, session.user.id);
  } catch {
    notFound();
  }

  const [template, candidateCount, certificates] = await Promise.all([
    CertificateTemplate.findOne({ eventId: event._id }).lean(),
    Candidate.countDocuments({ eventId: event._id }),
    Certificate.find({ eventId: event._id }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const serialized = serializeEvent(event);
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : undefined;
  const publicUrl = absoluteUrl(`/public/${event.slug}`, origin);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
            <Badge variant={event.status === "PUBLISHED" ? "success" : "outline"}>{event.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.organizerName} · {formatDate(event.eventDate)}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <EventActions eventId={String(event._id)} status={event.status} publicUrl={publicUrl} />
      </div>

      <EventNav eventId={eventId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Candidates</CardDescription>
            <CardTitle>{candidateCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Generated</CardDescription>
            <CardTitle>{serialized.generatedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Downloads</CardDescription>
            <CardTitle>{serialized.downloadCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Verifications</CardDescription>
            <CardTitle>{serialized.verificationCount}</CardTitle>
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
            <Step done={Boolean(template)} label="Upload certificate background" href={`/admin/events/${eventId}/template`} />
            <Step
              done={Boolean(template?.configuration?.fields?.length)}
              label="Design template fields"
              href={`/admin/events/${eventId}/template`}
            />
            <Step done={candidateCount > 0} label="Import candidates CSV" href={`/admin/events/${eventId}/candidates`} />
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
