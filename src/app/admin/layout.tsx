import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminMobileHeader } from "@/components/admin/mobile-header";
import { NavigationProgress } from "@/components/admin/navigation-progress";
import { AdminTopbar } from "@/components/admin/topbar";
import { redirect } from "next/navigation";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="admin-shell flex min-h-screen">
      <NavigationProgress />
      <div className="sticky top-0 hidden h-screen md:block">
        <AdminSidebar userName={session.user.name} role={session.user.role} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader userName={session.user.name} role={session.user.role} />
        <AdminTopbar userName={session.user.name} role={session.user.role} />
        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
