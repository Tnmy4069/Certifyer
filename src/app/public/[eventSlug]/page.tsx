import { notFound } from "next/navigation";
import { connectDb } from "@/lib/db";
import { Event } from "@/models";
import { PublicPortalClient } from "@/components/public/portal-client";

type Params = { params: Promise<{ eventSlug: string }> };

export default async function PublicEventPortalPage({ params }: Params) {
  const { eventSlug } = await params;
  await connectDb();
  const event = await Event.findOne({ slug: eventSlug, status: "PUBLISHED" }).lean();
  if (!event) notFound();

  return (
    <PublicPortalClient
      eventSlug={event.slug}
      eventName={event.name}
      organizerName={event.organizerName ?? ""}
      linkedinOrganizationId={event.linkedinOrganizationId ?? ""}
      linkedinCertificationName={event.linkedinCertificationName ?? ""}
    />
  );
}

