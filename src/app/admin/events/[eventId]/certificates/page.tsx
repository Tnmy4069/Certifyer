import { CertificatesManager } from "@/components/admin/certificates-manager";

type Params = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ setup?: string }>;
};

export default async function CertificatesPage({ params, searchParams }: Params) {
  const { eventId } = await params;
  const { setup } = await searchParams;
  return <CertificatesManager eventId={eventId} setup={setup === "1"} />;
}
