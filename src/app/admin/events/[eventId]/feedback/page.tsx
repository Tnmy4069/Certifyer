import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { Feedback } from "@/models";
import { EventNav } from "@/components/admin/event-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RatingBars } from "@/components/admin/rating-bars";
import { StatCard } from "@/components/admin/stat-card";
import { CsvExportButton } from "@/components/admin/csv-export-button";
import { formatDateTime } from "@/lib/utils";

type Params = { params: Promise<{ eventId: string }> };

export default async function EventFeedbackPage({ params }: Params) {
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

  const feedback = await Feedback.find({ eventId: event._id }).sort({ createdAt: -1 }).lean();
  const avg =
    feedback.length === 0 ? 0 : feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length;
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of feedback) {
    const rating = item.rating as 1 | 2 | 3 | 4 | 5;
    if (ratingCounts[rating] !== undefined) ratingCounts[rating] += 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ratings and remarks for {event.name}.
          </p>
        </div>
        <CsvExportButton
          filename={`${event.slug}-feedback.csv`}
          headers={["Candidate", "Email", "Rating", "Remark", "Submitted"]}
          rows={feedback.map((item) => [
            item.candidateName,
            item.candidateEmail,
            item.rating,
            item.remark || "",
            item.createdAt ? new Date(item.createdAt).toISOString() : "",
          ])}
        />
      </div>
      <EventNav eventId={eventId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Reviews" value={feedback.length} />
        <StatCard label="Average rating" value={feedback.length ? avg.toFixed(1) : "—"} />
        <StatCard label="With remarks" value={feedback.filter((item) => Boolean(item.remark)).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              Rating mix
            </CardTitle>
            <CardDescription>How candidates rated this event.</CardDescription>
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
            <CardDescription>Comments submitted before download.</CardDescription>
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
