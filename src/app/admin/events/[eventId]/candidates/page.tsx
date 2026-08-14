import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventNav } from "@/components/admin/event-nav";
import {
  CsvImportWizard,
  type CandidateListItem,
} from "@/components/candidates/csv-import-wizard";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { Candidate } from "@/models";

type Params = { params: Promise<{ eventId: string }> };

export default async function CandidatesPage({ params }: Params) {
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

  const documents = await Candidate.find({ eventId: event._id }).sort({ createdAt: -1 }).lean();
  const candidates: CandidateListItem[] = documents.map((candidate) => ({
    id: String(candidate._id),
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone ?? "",
    role: candidate.role ?? "",
    organization: candidate.organization ?? "",
    department: candidate.department ?? "",
    metadata: (candidate.metadata ?? {}) as Record<string, string>,
    createdAt: candidate.createdAt?.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import and manage the candidates who will receive certificates.
        </p>
      </div>
      <EventNav eventId={eventId} />
      <CsvImportWizard eventId={eventId} initialCandidates={candidates} />
    </div>
  );
}
