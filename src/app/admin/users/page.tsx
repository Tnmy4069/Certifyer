import { auth } from "@/auth";
import { UserManager } from "@/components/admin/user-manager";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create administrators and review platform access.
        </p>
      </div>
      <UserManager />
    </div>
  );
}
