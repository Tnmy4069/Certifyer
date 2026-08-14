import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { Event } from "@/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatShortDate } from "@/lib/utils";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  const events = await Event.find({ createdBy: session.user.id }).sort({ createdAt: -1 }).lean();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage certificate campaigns.</p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">New Event</Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events"
          description="Start by creating an event and uploading a blank certificate."
          actionLabel="Create Event"
          actionHref="/admin/events/new"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Link key={String(event._id)} href={`/admin/events/${event._id}`}>
              <Card className="h-full transition-colors hover:border-slate-300">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{event.name}</CardTitle>
                    <Badge variant={event.status === "PUBLISHED" ? "success" : "outline"}>{event.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{event.organizerName}</p>
                  <p>{formatShortDate(event.eventDate)}</p>
                  <p>
                    {event.candidateCount} candidates · {event.generatedCount} generated
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
