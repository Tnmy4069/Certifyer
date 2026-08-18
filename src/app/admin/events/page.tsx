import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, Plus, Search, Users } from "lucide-react";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db";
import { eventAccessFilter, eventOwnerLabel } from "@/lib/events/helpers";
import { Event } from "@/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { formatShortDate } from "@/lib/utils";

type EventListItem = {
  _id: unknown;
  name: string;
  organizerName: string;
  status: string;
  eventDate: Date;
  candidateCount: number;
  generatedCount: number;
};

function EventCard({ event }: { event: EventListItem }) {
  return (
    <Link href={`/admin/events/${event._id}`} className="group block h-full">
      <article className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{event.name}</h3>
          <Badge variant={event.status === "PUBLISHED" ? "success" : event.status === "ARCHIVED" ? "muted" : "outline"}>
            {event.status}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-slate-500">{event.organizerName}</p>
        <div className="mt-auto flex items-center justify-between pt-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatShortDate(event.eventDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {event.candidateCount} · {event.generatedCount} issued
          </span>
        </div>
      </article>
    </Link>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { q, status } = await searchParams;
  await connectDb();
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const events = (
    await Event.find(eventAccessFilter(session.user.id, session.user.role))
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean()
  ).filter((event) => {
    if (status === "DRAFT" || status === "PUBLISHED" || status === "ARCHIVED") {
      if (event.status !== status) return false;
    }
    const term = q?.trim().toLowerCase();
    if (!term) return true;
    return (
      event.name.toLowerCase().includes(term) ||
      event.organizerName.toLowerCase().includes(term) ||
      event.slug.toLowerCase().includes(term)
    );
  });

  const ownerGroups = isSuperAdmin
    ? Object.values(
        events.reduce<Record<string, { key: string; label: string; events: typeof events }>>((groups, event) => {
          const owner = eventOwnerLabel(event.createdBy) ?? "Unknown owner";
          const key =
            event.createdBy && typeof event.createdBy === "object" && "_id" in event.createdBy
              ? String((event.createdBy as { _id: unknown })._id)
              : owner;
          if (!groups[key]) {
            groups[key] = { key, label: owner, events: [] };
          }
          groups[key].events.push(event);
          return groups;
        }, {}),
      )
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={
          isSuperAdmin
            ? "All certificate campaigns created by every admin."
            : "Create and manage certificate campaigns."
        }
        actions={
          <Button asChild className="rounded-xl">
            <Link href="/admin/events/new">
              <Plus className="h-4 w-4" />
              New event
            </Link>
          </Button>
        }
      />

      <form className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center" action="/admin/events">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, organizer, or slug"
            className="border-0 bg-slate-50 pl-9 shadow-none"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="submit" variant="outline" className="rounded-xl">
          Filter
        </Button>
      </form>

      {events.length === 0 ? (
        <EmptyState
          title={q || status ? "No matching events" : "No events"}
          description={
            q || status
              ? "Try a different search or status filter."
              : "Start by creating an event and uploading a blank certificate."
          }
          actionLabel={q || status ? undefined : "Create Event"}
          actionHref={q || status ? undefined : "/admin/events/new"}
        />
      ) : isSuperAdmin ? (
        <div className="space-y-8">
          {ownerGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight text-slate-700">{group.label}</h2>
                <p className="text-xs text-slate-500">
                  {group.events.length} {group.events.length === 1 ? "event" : "events"}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.events.map((event) => (
                  <EventCard key={String(event._id)} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={String(event._id)} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
