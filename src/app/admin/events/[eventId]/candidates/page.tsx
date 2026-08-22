import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { EventNav } from "@/components/admin/event-nav";
import { EventSetupStepper } from "@/components/admin/event-setup-stepper";
import {
  CsvImportWizard,
  type CandidateListItem,
} from "@/components/candidates/csv-import-wizard";
import { Button } from "@/components/ui/button";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { Candidate } from "@/models";

type Params = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ setup?: string }>;
};

export default async function CandidatesPage({ params, searchParams }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { eventId } = await params;
  const { setup } = await searchParams;
  const isSetup = setup === "1";

  await connectDb();
  let event;
  try {
    event = await getOwnedEvent(eventId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const [documents, totalCount] = await Promise.all([
    Candidate.find({ eventId: event._id }).sort({ createdAt: -1 }).limit(100).lean(),
    Candidate.countDocuments({ eventId: event._id }),
  ]);
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
          {isSetup
            ? "Step 2 of 4 — import candidates, then continue to the certificate template."
            : "Import and manage the candidates who will receive certificates."}
        </p>
      </div>
      {isSetup ? <EventSetupStepper eventId={eventId} current="candidates" /> : <EventNav eventId={eventId} />}
      <CsvImportWizard
        eventId={eventId}
        initialCandidates={candidates}
        totalCandidateCount={totalCount}
        setupNextHref={isSetup ? `/admin/events/${eventId}/template?setup=1` : undefined}
      />
      {isSetup ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/admin/events/${eventId}/template?setup=1`}>
              Skip for now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
