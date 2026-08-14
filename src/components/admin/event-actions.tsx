"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";

export function EventActions({
  eventId,
  status,
  publicUrl,
}: {
  eventId: string;
  status: string;
  publicUrl: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(next: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update status");
      toast.success(`Event ${next.toLowerCase()}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(publicUrl);
          toast.success("Public URL copied");
        }}
      >
        <Copy className="h-4 w-4" />
        Copy public URL
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={publicUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" />
          Open portal
        </a>
      </Button>
      {status !== "PUBLISHED" ? (
        <Button size="sm" disabled={loading} onClick={() => updateStatus("PUBLISHED")}>
          Publish
        </Button>
      ) : (
        <Button size="sm" variant="secondary" disabled={loading} onClick={() => updateStatus("DRAFT")}>
          Unpublish
        </Button>
      )}
    </div>
  );
}
