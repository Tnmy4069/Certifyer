import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
          C
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Certify</h1>
        <p className="mt-3 text-base text-slate-600">
          Create, generate, distribute, and verify event certificates with a modern issuance workflow.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Admin sign in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/admin">Open dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
