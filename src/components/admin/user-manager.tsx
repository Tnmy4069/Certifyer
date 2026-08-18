"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortDate } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  createdAt: string;
};

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    const confirmation = String(values.get("confirmation") || "");

    if (password !== confirmation) {
      toast.error("Passwords do not match");
      return;
    }

    setResetting(true);
    try {
      const response = await fetch(`/api/users/${user.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset password");

      form.reset();
      setOpen(false);
      toast.success(`Password reset for ${user.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset password");
    } finally {
      setResetting(false);
    }
  }

  return (
    <AlertDialogRoot open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Reset password
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Reset password</AlertDialogTitle>
        <AlertDialogDescription>
          Set a new password for {user.name} ({user.email}).
        </AlertDialogDescription>
        <form className="mt-5 space-y-4" onSubmit={resetPassword}>
          <div className="space-y-2">
            <Label htmlFor={`password-${user.id}`}>New password</Label>
            <Input
              id={`password-${user.id}`}
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`confirmation-${user.id}`}>Confirm password</Label>
            <Input
              id={`confirmation-${user.id}`}
              name="confirmation"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel type="button" disabled={resetting}>
              Cancel
            </AlertDialogCancel>
            <Button type="submit" disabled={resetting}>
              {resetting ? "Resetting..." : "Reset password"}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialogRoot>
  );
}

export function UserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/users");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load users");
    setUsers(data.users);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load users");
        return data.users as UserRow[];
      })
      .then((loadedUsers) => {
        if (!cancelled) setUsers(loadedUsers);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const form = event.currentTarget;
    const values = new FormData(form);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          email: values.get("email"),
          password: values.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create user");

      form.reset();
      toast.success("Admin user created");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create user");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Create admin</CardTitle>
          <CardDescription>
            New users receive normal admin access. Super admins can only be
            configured through environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={createUser}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button className="w-full" disabled={creating}>
              {creating ? "Creating..." : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Administrators who can access Certify.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{user.name}</td>
                      <td className="py-3 text-muted-foreground">{user.email}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            user.role === "SUPER_ADMIN" ? "default" : "outline"
                          }
                        >
                          {user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatShortDate(user.createdAt)}
                      </td>
                      <td className="py-3 text-right">
                        {user.role === "ADMIN" ? (
                          <ResetPasswordDialog user={user} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
