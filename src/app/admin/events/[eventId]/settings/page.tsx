"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { Archive, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { EventNav } from "@/components/admin/event-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventStatus } from "@/lib/types";

type EventForm = {
  id: string;
  name: string;
  slug: string;
  description: string;
  organizerName: string;
  eventDate: string;
  location: string;
  status: EventStatus;
  linkedinOrganizationId: string;
  linkedinCertificationName: string;
};

function errorMessage(data: unknown, fallback: string) {
  return data && typeof data === "object" && "error" in data && typeof data.error === "string"
    ? data.error
    : fallback;
}

export default function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<EventForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState<EventStatus | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(errorMessage(data, "Could not load event settings"));
        if (active) {
          const loaded = data.event;
          setEvent({
            ...loaded,
            description: loaded.description ?? "",
            location: loaded.location ?? "",
            eventDate: new Date(loaded.eventDate).toISOString().slice(0, 10),
            linkedinOrganizationId: loaded.linkedinOrganizationId ?? "",
            linkedinCertificationName: loaded.linkedinCertificationName ?? "",
          });
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load event settings");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  async function patch(payload: Partial<EventForm>) {
    const response = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data, "Could not update event"));
    const updated = data.event;
    setEvent((current) =>
      current
        ? {
            ...current,
            ...updated,
            description: updated.description ?? "",
            location: updated.location ?? "",
            eventDate: new Date(updated.eventDate).toISOString().slice(0, 10),
          }
        : current,
    );
  }

  async function saveBasics(eventObject: FormEvent) {
    eventObject.preventDefault();
    if (!event) return;
    setSaving(true);
    try {
      await patch({
        name: event.name,
        slug: event.slug,
        description: event.description,
        organizerName: event.organizerName,
        eventDate: event.eventDate,
        location: event.location,
      });
      toast.success("Event settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save event settings");
    } finally {
      setSaving(false);
    }
  }

  const [linkedinSaving, setLinkedinSaving] = useState(false);

  async function saveLinkedin(eventObject: FormEvent) {
    eventObject.preventDefault();
    if (!event) return;
    setLinkedinSaving(true);
    try {
      await patch({
        linkedinOrganizationId: event.linkedinOrganizationId,
        linkedinCertificationName: event.linkedinCertificationName,
      });
      toast.success("LinkedIn settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save LinkedIn settings");
    } finally {
      setLinkedinSaving(false);
    }
  }

  async function updateStatus(status: EventStatus) {
    setStatusLoading(status);
    try {
      await patch({ status });
      toast.success(status === "PUBLISHED" ? "Event published" : status === "ARCHIVED" ? "Event archived" : "Event moved to draft");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update event status");
    } finally {
      setStatusLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Event settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update event details, publishing, and lifecycle status.</p>
      </div>
      <EventNav eventId={eventId} />

      {loading ? (
        <Card>
          <CardContent className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !event ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Event settings could not be loaded.
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
              <CardDescription>These details appear in the admin dashboard and public certificate portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={saveBasics}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="event-name">Event name</Label>
                    <Input
                      id="event-name"
                      required
                      minLength={2}
                      maxLength={120}
                      value={event.name}
                      onChange={(input) => setEvent({ ...event, name: input.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizer-name">Organizer</Label>
                    <Input
                      id="organizer-name"
                      required
                      minLength={2}
                      maxLength={120}
                      value={event.organizerName}
                      onChange={(input) => setEvent({ ...event, organizerName: input.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-date">Event date</Label>
                    <Input
                      id="event-date"
                      type="date"
                      required
                      value={event.eventDate}
                      onChange={(input) => setEvent({ ...event, eventDate: input.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-location">Location</Label>
                    <Input
                      id="event-location"
                      maxLength={200}
                      placeholder="Online or venue name"
                      value={event.location}
                      onChange={(input) => setEvent({ ...event, location: input.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-slug">Public URL slug</Label>
                    <Input
                      id="event-slug"
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={event.slug}
                      onChange={(input) => setEvent({ ...event, slug: input.target.value.toLowerCase() })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="event-description">Description</Label>
                    <Textarea
                      id="event-description"
                      rows={5}
                      maxLength={2000}
                      value={event.description}
                      onChange={(input) => setEvent({ ...event, description: input.target.value })}
                    />
                    <p className="text-right text-xs text-muted-foreground">{event.description.length}/2000</p>
                  </div>
                </div>
                <div className="flex justify-end border-t pt-5">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Event status</CardTitle>
                  <CardDescription className="mt-1">Control portal availability.</CardDescription>
                </div>
                <Badge variant={event.status === "PUBLISHED" ? "success" : "outline"}>{event.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">
                  {event.status === "PUBLISHED"
                    ? "The event is live"
                    : event.status === "ARCHIVED"
                      ? "The event is archived"
                      : "The event is in draft"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Publishing requires a background and at least one configured certificate field.
                </p>
              </div>
              {event.status !== "PUBLISHED" ? (
                <Button
                  className="w-full"
                  disabled={Boolean(statusLoading)}
                  onClick={() => void updateStatus("PUBLISHED")}
                >
                  {statusLoading === "PUBLISHED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publish event
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={Boolean(statusLoading)}
                  onClick={() => void updateStatus("DRAFT")}
                >
                  Move to draft
                </Button>
              )}
              {event.status !== "ARCHIVED" && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={Boolean(statusLoading)}
                  onClick={() => void updateStatus("ARCHIVED")}
                >
                  {statusLoading === "ARCHIVED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  Archive event
                </Button>
              )}
            </CardContent>
          </Card>

          {/* LinkedIn sharing settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>LinkedIn sharing</CardTitle>
              <CardDescription>
                When filled in, candidates will see an "Add to LinkedIn Profile" button and a general
                share link after downloading their certificate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={saveLinkedin}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="li-org-id">LinkedIn Organization ID</Label>
                    <Input
                      id="li-org-id"
                      placeholder="e.g. 12345678"
                      maxLength={80}
                      value={event.linkedinOrganizationId}
                      onChange={(input) => setEvent({ ...event, linkedinOrganizationId: input.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Found at linkedin.com/company/your-org — click &quot;Admin tools&quot; → &quot;Edit page&quot;
                      and copy the numeric ID from the URL.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="li-cert-name">Certification name on LinkedIn</Label>
                    <Input
                      id="li-cert-name"
                      placeholder="e.g. TechFest 2026 Participation Certificate"
                      maxLength={200}
                      value={event.linkedinCertificationName}
                      onChange={(input) => setEvent({ ...event, linkedinCertificationName: input.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will appear in the candidate&apos;s LinkedIn certifications section.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end border-t pt-5">
                  <Button type="submit" disabled={linkedinSaving}>
                    {linkedinSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save LinkedIn settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
