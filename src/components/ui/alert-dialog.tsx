"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

export const AlertDialogRoot = AlertDialog.Root;
export const AlertDialogTrigger = AlertDialog.Trigger;
export const AlertDialogPortal = AlertDialog.Portal;

export function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialog.Overlay>) {
  return <AlertDialog.Overlay className={cn("fixed inset-0 z-50 bg-black/40", className)} {...props} />;
}

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialog.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialog.Title>) {
  return <AlertDialog.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialog.Description>) {
  return <AlertDialog.Description className={cn("mt-2 text-sm text-muted-foreground", className)} {...props} />;
}

export function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof AlertDialog.Action>) {
  return <AlertDialog.Action className={cn(buttonVariants(), className)} {...props} />;
}

export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialog.Cancel>) {
  return <AlertDialog.Cancel className={cn(buttonVariants({ variant: "outline" }), "mt-0", className)} {...props} />;
}
