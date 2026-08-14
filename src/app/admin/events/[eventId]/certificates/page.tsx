import { CertificatesManager } from "@/components/admin/certificates-manager";

type Params = { params: Promise<{ eventId: string }> };

export default async function CertificatesPage({ params }: Params) {
  const { eventId } = await params;
  return <CertificatesManager eventId={eventId} />;
}
