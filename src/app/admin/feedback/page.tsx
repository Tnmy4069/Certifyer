import { redirect } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { eventAccessFilter } from "@/lib/events/helpers";
import { Event, Feedback } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RatingBars } from "@/components/admin/rating-bars";
import { StatCard } from "@/components/admin/stat-card";
import { CsvExportButton } from "@/components/admin/csv-export-button";
import { PageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/utils";

type SearchParams = { searchParams: Promise<{ event?: string }> };

export default async function FeedbackPage({ searchParams }: SearchParams) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { event: eventFilter } = await searchParams;

  await connectDb();
  const events = await Event.find(eventAccessFilter(session.user.id, session.user.role))
    .select("name")
    .sort({ createdAt: -1 })
    .lean();
  const eventIds = events.map((event) => event._id);
  const eventNameById = new Map(events.map((event) => [String(event._id), event.name]));
  const selectedEventId = eventFilter && eventIds.some((id) => String(id) === eventFilter) ? eventFilter : "";

  const match = selectedEventId
    ? { eventId: selectedEventId }
    : { eventId: { $in: eventIds } };

  const feedback = eventIds.length
    ? await Feedback.find(match).sort({ createdAt: -1 }).limit(300).lean()
    : [];
  const avg =
    feedback.length === 0
      ? 0
      : feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length;
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of feedback) {
    const rating = item.rating as 1 | 2 | 3 | 4 | 5;
    if (ratingCounts[rating] !== undefined) ratingCounts[rating] += 1;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Ratings and remarks submitted before certificate download."
        actions={
          <CsvExportButton
            filename="certify-feedback.csv"
            headers={["Event", "Candidate", "Email", "Rating", "Remark", "Submitted"]}
            rows={feedback.map((item) => [
              eventNameById.get(String(item.eventId)) ?? "",
              item.candidateName,
              item.candidateEmail,
              item.rating,
              item.remark || "",
              item.createdAt ? new Date(item.createdAt).toISOString() : "",
            ])}
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/feedback" className={!selectedEventId ? "admin-chip admin-chip-active" : "admin-chip"}>
          All events
        </Link>
        {events.map((event) => {
          const id = String(event._id);
          const active = selectedEventId === id;
          return (
            <Link
              key={id}
              href={`/admin/feedback?event=${id}`}
              className={active ? "admin-chip admin-chip-active" : "admin-chip"}
            >
              {event.name}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Reviews" value={feedback.length} />
        <StatCard label="Average rating" value={feedback.length ? avg.toFixed(1) : "—"} />
        <StatCard
          label="With remarks"
          value={feedback.filter((item) => Boolean(item.remark)).length}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              Rating mix
            </CardTitle>
            <CardDescription>Distribution of 1–5 star ratings.</CardDescription>
          </CardHeader>
          <CardContent>
            {feedback.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ratings yet.</p>
            ) : (
              <RatingBars counts={ratingCounts} total={feedback.length} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
            <CardDescription>Latest candidate comments.</CardDescription>
          </CardHeader>
          <CardContent>
            {feedback.length === 0 ? (
              <EmptyState
                title="No feedback yet"
                description="Candidates submit a rating before downloading their certificate."
              />
            ) : (
              <div className="space-y-3">
                {feedback.map((item) => (
                  <div key={String(item._id)} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{item.candidateEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.rating}/5</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {eventNameById.get(String(item.eventId)) ?? "Event"}
                    </p>
                    {item.remark ? (
                      <p className="mt-2 text-sm italic">&ldquo;{item.remark}&rdquo;</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No remark provided.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
