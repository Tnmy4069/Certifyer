import { PublicPortalClient } from "@/components/public/portal-client";

export const metadata = {
  title: "Certify | Download & Verify Certificates",
  description: "Official certificate portal to find, download, and verify your event credentials and licenses.",
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#050505] overflow-hidden">
      {/* Crazy decorative background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Deep Red Glow */}
        <div className="absolute -top-[20%] left-[20%] -translate-x-1/2 h-[40rem] w-[50rem] rounded-full bg-red-600/20 blur-[100px] mix-blend-screen opacity-70 animate-pulse" />
        
        {/* Cyber Yellow Glow */}
        <div className="absolute top-[40%] right-[-10%] h-[35rem] w-[35rem] rounded-full bg-yellow-500/15 blur-[120px] mix-blend-screen opacity-60" />
        
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CgkJPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPgoJCTxwYXRoIGQ9Ik0wIDEwaDQwTTEwIDB2NDBNMCAyMGg0ME0yMCAwdjQwTTAgMzBoNDBNMzAgMHY0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+')] opacity-50" />
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center pt-10">
        <PublicPortalClient
          title="Download Your Certificate"
          subtitle="Enter your registration email to instantly retrieve, download, and add your official credentials to LinkedIn."
        />
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-slate-500 border-t border-red-900/20 bg-black/40 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} Certify. All rights reserved. Built with ❤️ and 🔥</p>
      </footer>
    </div>
  );
}
