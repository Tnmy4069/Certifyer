import { Suspense } from "react";
import SuperAdminLoginForm from "./superadmin-login-form";

export const metadata = {
  title: "System Access",
  robots: "noindex, nofollow",
};

export default function SuperAdminLoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050508]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
        </div>
      }
    >
      <SuperAdminLoginForm />
    </Suspense>
  );
}
