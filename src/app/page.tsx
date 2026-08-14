import { PublicPortalClient } from "@/components/public/portal-client";

export const metadata = {
  title: "Certify | Download & Verify Certificates",
  description: "Official certificate portal to find, download, and verify your event credentials and licenses.",
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Subtle decorative background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[36rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 right-10 h-72 w-72 rounded-full bg-blue-400/5 blur-3xl" />
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center">
        <PublicPortalClient
          title="Download Your Certificate"
          subtitle="Enter your registration email to find, download, and share your official credentials."
        />
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-muted-foreground border-t border-border/40">
        <p>© {new Date().getFullYear()} Certify. All rights reserved.</p>
      </footer>
    </div>
  );
}
