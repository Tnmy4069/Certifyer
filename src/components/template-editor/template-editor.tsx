"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Minus, Plus, Save, Upload, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateConfig, TemplateField } from "@/lib/types";
import { TemplateCanvas } from "./canvas";
import { FieldPanel } from "./field-panel";
import { PropertiesPanel } from "./properties-panel";

export type EditorTemplate = {
  backgroundUrl: string;
  width: number;
  height: number;
  configuration: TemplateConfig;
};

export type SampleCandidate = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  organization?: string;
  department?: string;
  metadata?: Record<string, unknown>;
};

export type EventPreviewData = {
  name: string;
  organizerName: string;
  eventDate: Date | string | null;
};

const EMPTY_CONFIGURATION: TemplateConfig = {
  fields: [],
  qr: { enabled: false, x: 40, y: 40, size: 120 },
};

function apiError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

export function TemplateEditor({
  eventId,
  initialTemplate,
  event,
  sampleCandidates = [],
}: {
  eventId: string;
  initialTemplate: EditorTemplate | null;
  event?: EventPreviewData;
  sampleCandidates?: SampleCandidate[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState(initialTemplate);
  const [configuration, setConfiguration] = useState<TemplateConfig>(
    initialTemplate?.configuration ?? EMPTY_CONFIGURATION,
  );
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const liveValues = useMemo(() => {
    if (!event) return undefined;
    const candidate =
      sampleCandidates && sampleCandidates.length > 0
        ? sampleCandidates[selectedCandidateIndex] || sampleCandidates[0]
        : null;

    const d = event.eventDate ? new Date(event.eventDate) : new Date();
    const dateFormatted = !isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const year = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();

    const values: Record<string, string> = {
      event_name: event.name || "Event Name",
      event_date: dateFormatted || "Event Date",
      organizer: event.organizerName || "Organizer Name",
      certificate_id: `CERT-${year}-00001`,
      name: candidate?.name || "Candidate Name",
      candidate_name: candidate?.name || "Candidate Name",
      email: candidate?.email || "candidate@example.com",
      phone: candidate?.phone || "+1 (555) 000-0000",
      role: candidate?.role || "Participant",
      organization: candidate?.organization || event.organizerName || "Organization",
      department: candidate?.department || "General",
    };

    if (candidate?.metadata && typeof candidate.metadata === "object") {
      for (const [k, v] of Object.entries(candidate.metadata)) {
        if (v !== undefined && v !== null) {
          values[k] = String(v);
        }
      }
    }

    return values;
  }, [event, sampleCandidates, selectedCandidateIndex]);

  const selectedField = configuration.fields.find((field) => field.id === selectedId) ?? null;

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setConfiguration((current) => ({
      ...current,
      fields: current.fields.filter((field) => field.id !== selectedId),
    }));
    setSelectedId(null);
    setDirty(true);
  }, [selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    setConfiguration((current) => {
      const source = current.fields.find((field) => field.id === selectedId);
      if (!source) return current;
      const duplicate: TemplateField = {
        ...source,
        id: crypto.randomUUID(),
        label: `${source.label} copy`,
        x: source.x + 20,
        y: source.y + 20,
      };
      setSelectedId(duplicate.id);
      return { ...current, fields: [...current.fields, duplicate] };
    });
    setDirty(true);
  }, [selectedId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, duplicateSelected]);

  function addField(source: string, label: string, customText?: string) {
    const width = template?.width ?? 1200;
    const height = template?.height ?? 800;
    const field: TemplateField = {
      id: crypto.randomUUID(),
      type: "text",
      source: source === "custom" ? "custom" : source,
      label,
      customText: customText ?? (source === "custom" ? "Certificate of Completion" : ""),
      x: Math.round(width * 0.25),
      y: Math.round(height * 0.45),
      width: Math.round(width * 0.5),
      height: Math.max(50, Math.round(height * 0.08)),
      fontFamily: "Inter",
      fontSize: Math.max(24, Math.round(width * 0.032)),
      fontWeight: 600,
      color: "#111827",
      align: "center",
      letterSpacing: 0,
      lineHeight: 1.2,
    };
    setConfiguration((current) => ({ ...current, fields: [...current.fields, field] }));
    setSelectedId(field.id);
    setDirty(true);
  }

  function updateField(id: string, patch: Partial<TemplateField>) {
    setConfiguration((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    }));
    setDirty(true);
  }

  async function uploadBackground(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("background", file);
      const response = await fetch(`/api/events/${eventId}/template`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(apiError(data, "Background upload failed"));
      const uploaded = data.template as EditorTemplate;
      setTemplate(uploaded);
      setConfiguration(uploaded.configuration ?? configuration);
      setSelectedId(null);
      setDirty(false);
      toast.success("Certificate background uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Background upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save() {
    if (!template) {
      toast.error("Upload a certificate background first.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configuration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiError(data, "Could not save template"));
      setDirty(false);
      toast.success("Template saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <ImagePlus className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Certificate designer</p>
                {dirty && <Badge variant="outline">Unsaved</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {template
                  ? `${template.width} × ${template.height}px source image`
                  : "Upload a background to start designing."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sampleCandidates.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-muted-foreground">Preview:</span>
                <select
                  value={selectedCandidateIndex}
                  onChange={(e) => setSelectedCandidateIndex(Number(e.target.value))}
                  className="bg-transparent font-medium text-xs focus:outline-none cursor-pointer"
                >
                  {sampleCandidates.map((c, idx) => (
                    <option key={c.id || idx} value={idx}>
                      {c.name} {c.role ? `(${c.role})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center rounded-md border bg-background">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Zoom out"
                disabled={!template || zoom <= 50}
                onClick={() => setZoom((value) => Math.max(50, value - 10))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-12 text-center text-xs font-medium tabular-nums">{zoom}%</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Zoom in"
                disabled={!template || zoom >= 180}
                onClick={() => setZoom((value) => Math.min(180, value + 10))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadBackground(file);
              }}
            />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {template ? "Replace background" : "Upload background"}
            </Button>
            <Button size="sm" disabled={!template || saving || !dirty} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save template
            </Button>
          </div>
        </CardContent>
      </Card>

      {template ? (
        <div className="grid items-start gap-4 xl:grid-cols-[230px_minmax(0,1fr)_280px]">
          <FieldPanel
            qr={configuration.qr}
            onAddField={addField}
            onQrChange={(qr) => {
              setConfiguration((current) => ({ ...current, qr }));
              setDirty(true);
            }}
          />
          <TemplateCanvas
            backgroundUrl={template.backgroundUrl}
            originalWidth={template.width}
            originalHeight={template.height}
            fields={configuration.fields}
            qr={configuration.qr}
            zoom={zoom}
            selectedId={selectedId}
            liveValues={liveValues}
            onSelect={setSelectedId}
            onFieldChange={updateField}
          />
          <PropertiesPanel
            field={selectedField}
            qr={configuration.qr}
            onFieldChange={(patch) => selectedId && updateField(selectedId, patch)}
            onQrChange={(qr) => {
              setConfiguration((current) => ({ ...current, qr }));
              setDirty(true);
            }}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[500px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <span className="mb-4 rounded-2xl border bg-background p-4 shadow-sm">
            <Upload className="h-7 w-7 text-muted-foreground" />
          </span>
          <span className="text-base font-semibold">Upload your certificate background</span>
          <span className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Use a high-resolution landscape PNG, JPEG, or WebP. Field coordinates stay anchored to its original pixel dimensions.
          </span>
        </button>
      )}
    </div>
  );
}
