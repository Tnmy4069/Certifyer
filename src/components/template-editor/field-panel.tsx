"use client";

import { Braces, CalendarDays, Hash, Image, Plus, QrCode, Type, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BUILTIN_FIELD_SOURCES, type QrConfig } from "@/lib/types";

const palette = [
  { source: "name", icon: UserRound },
  { source: "event_name", icon: Type },
  { source: "event_date", icon: CalendarDays },
  { source: "certificate_id", icon: Hash },
  { source: "role", icon: Braces },
  { source: "organization", icon: Image },
] as const;

export function FieldPanel({
  qr,
  onAddField,
  onQrChange,
}: {
  qr: QrConfig;
  onAddField: (source: string, label: string, customText?: string) => void;
  onQrChange: (qr: QrConfig) => void;
}) {
  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Available fields</CardTitle>
          <Badge variant="outline">{palette.length + 2}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Add text blocks or dynamic placeholders.</p>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        {/* Custom Text Section */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Freeform / Static Text</p>
          <Button
            variant="outline"
            className="h-10 w-full justify-start gap-2.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 font-medium text-xs shadow-sm"
            onClick={() => onAddField("custom", "Certificate Title", "Certificate of Completion")}
          >
            <Type className="h-4 w-4" />
            + Add Custom Static Text
          </Button>
        </div>

        {/* Dynamic Fields Section */}
        <div className="space-y-2 pt-1 border-t">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Dynamic Data Fields</p>
          <div className="grid gap-1.5">
            {palette.map(({ source, icon: Icon }) => {
              const field = BUILTIN_FIELD_SOURCES.find((item) => item.source === source)!;
              return (
                <Button
                  key={source}
                  variant="outline"
                  className="h-9 justify-start gap-2.5 bg-background px-3 font-normal text-xs"
                  onClick={() => onAddField(field.source, field.label)}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {field.label}
                  <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
                </Button>
              );
            })}
            <Button
              variant="outline"
              className="h-9 justify-start gap-2.5 border-dashed bg-background px-3 font-normal text-xs"
              onClick={() => onAddField("custom_field", "Custom Metadata")}
            >
              <Braces className="h-3.5 w-3.5 text-muted-foreground" />
              Custom Metadata Field
              <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <QrCode className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="qr-toggle" className="text-sm font-medium">
                  Verification QR
                </Label>
                <button
                  id="qr-toggle"
                  type="button"
                  role="switch"
                  aria-checked={qr.enabled}
                  onClick={() => onQrChange({ ...qr, enabled: !qr.enabled })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    qr.enabled ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      qr.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Adds a scannable verification area. Position and size it from the properties panel.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
