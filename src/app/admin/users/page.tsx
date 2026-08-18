import { auth } from "@/auth";
import { UserManager } from "@/components/admin/user-manager";
import { PageHeader } from "@/components/admin/page-header";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Create administrators and review platform access."
      />
      <UserManager />
    </div>
  );
}
