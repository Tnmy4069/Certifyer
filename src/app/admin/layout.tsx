import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminMobileNav } from "@/components/admin/mobile-nav";
import { AdminTopbar } from "@/components/admin/topbar";
import { redirect } from "next/navigation";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="admin-shell flex min-h-screen">
      <div className="sticky top-0 hidden h-screen md:block">
        <AdminSidebar userName={session.user.name} role={session.user.role} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="space-y-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white">
                C
              </div>
              <div>
                <p className="text-sm font-semibold">Certify</p>
                <p className="text-[11px] text-slate-500">{session.user.name}</p>
              </div>
            </div>
          </div>
          <AdminMobileNav role={session.user.role} />
        </header>
        <AdminTopbar userName={session.user.name} role={session.user.role} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
