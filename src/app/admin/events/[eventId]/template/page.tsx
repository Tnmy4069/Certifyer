import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventNav } from "@/components/admin/event-nav";
import { TemplateEditor, type EditorTemplate } from "@/components/template-editor/template-editor";
import { Badge } from "@/components/ui/badge";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { getStorage } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import { Candidate, CertificateTemplate } from "@/models";

type Params = { params: Promise<{ eventId: string }> };

export default async function EventTemplatePage({ params }: Params) {
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

  const [template, candidates] = await Promise.all([
    CertificateTemplate.findOne({ eventId: event._id }).lean(),
    Candidate.find({ eventId: event._id }).limit(10).lean(),
  ]);

  let editorTemplate: EditorTemplate | null = null;
  if (template) {
    editorTemplate = {
      backgroundUrl: getStorage().createSignedUrl(template.backgroundKey, 60 * 60),
      width: template.width,
      height: template.height,
      configuration: templateConfigSchema.parse(template.configuration ?? {}),
    };
  }

  const sampleCandidates = candidates.map((c) => ({
    id: String(c._id),
    name: c.name,
    email: c.email,
    phone: c.phone || "",
    role: c.role || "",
    organization: c.organization || "",
    department: c.department || "",
    metadata: (c.metadata as Record<string, unknown>) || {},
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Certificate template</h1>
            <Badge variant={template ? "muted" : "outline"}>
              {template ? "Background ready" : "Setup required"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Design the personalized certificate issued for {event.name}.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Tip: press Delete to remove a selected field.</p>
      </div>

      <EventNav eventId={eventId} />
      <TemplateEditor 
        eventId={eventId} 
        initialTemplate={editorTemplate} 
        event={{
          name: event.name,
          organizerName: event.organizerName,
          eventDate: event.eventDate,
        }}
        sampleCandidates={sampleCandidates}
      />
    </div>
  );
}
