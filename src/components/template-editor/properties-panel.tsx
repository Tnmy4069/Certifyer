"use client";

import { Copy, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FONT_FAMILIES,
  TEXT_ALIGNS,
  type QrConfig,
  type TemplateField,
} from "@/lib/types";

type NumericKey =
  | "fontSize"
  | "fontWeight"
  | "letterSpacing"
  | "lineHeight"
  | "width"
  | "height"
  | "x"
  | "y";

function NumberProperty({
  field,
  property,
  label,
  min,
  max,
  step,
  onChange,
}: {
  field: TemplateField;
  property: NumericKey;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (patch: Partial<TemplateField>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`property-${property}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`property-${property}`}
        type="number"
        value={Math.round(field[property] * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value)) onChange({ [property]: value });
        }}
        className="h-9"
      />
    </div>
  );
}

export function PropertiesPanel({
  field,
  qr,
  onFieldChange,
  onQrChange,
  onDuplicate,
  onDelete,
}: {
  field: TemplateField | null;
  qr: QrConfig;
  onFieldChange: (patch: Partial<TemplateField>) => void;
  onQrChange: (qr: QrConfig) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Properties</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          {field ? `Editing ${field.label}` : "Select a field on the canvas to edit it."}
        </p>
      </CardHeader>
      <CardContent className="p-4">
        {field ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="field-label" className="text-xs">Label</Label>
              <Input
                id="field-label"
                value={field.label}
                onChange={(event) => onFieldChange({ label: event.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-source" className="text-xs">Data source</Label>
              <Input
                id="field-source"
                value={field.source}
                onChange={(event) => onFieldChange({ source: event.target.value })}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="font-family" className="text-xs">Font family</Label>
                <select
                  id="font-family"
                  value={field.fontFamily}
                  onChange={(event) =>
                    onFieldChange({ fontFamily: event.target.value as TemplateField["fontFamily"] })
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {FONT_FAMILIES.map((font) => <option key={font}>{font}</option>)}
                </select>
              </div>
              <NumberProperty field={field} property="fontSize" label="Font size" min={8} max={200} onChange={onFieldChange} />
              <div className="space-y-1.5">
                <Label htmlFor="font-weight" className="text-xs">Weight</Label>
                <select
                  id="font-weight"
                  value={field.fontWeight}
                  onChange={(event) => onFieldChange({ fontWeight: Number(event.target.value) })}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {[300, 400, 500, 600, 700, 800].map((weight) => <option key={weight}>{weight}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="font-color" className="text-xs">Color</Label>
                <div className="flex h-9 gap-2">
                  <Input
                    id="font-color"
                    type="color"
                    value={field.color}
                    onChange={(event) => onFieldChange({ color: event.target.value })}
                    className="h-9 w-11 cursor-pointer p-1"
                  />
                  <Input
                    aria-label="Color hex value"
                    value={field.color}
                    onChange={(event) => onFieldChange({ color: event.target.value })}
                    className="h-9 min-w-0 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="text-align" className="text-xs">Alignment</Label>
                <select
                  id="text-align"
                  value={field.align}
                  onChange={(event) =>
                    onFieldChange({ align: event.target.value as TemplateField["align"] })
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm capitalize"
                >
                  {TEXT_ALIGNS.map((align) => <option key={align}>{align}</option>)}
                </select>
              </div>
              <NumberProperty field={field} property="letterSpacing" label="Letter spacing" step={0.1} onChange={onFieldChange} />
              <NumberProperty field={field} property="lineHeight" label="Line height" min={0.8} max={3} step={0.1} onChange={onFieldChange} />
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">GEOMETRY · ORIGINAL PIXELS</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberProperty field={field} property="x" label="X" min={0} onChange={onFieldChange} />
                <NumberProperty field={field} property="y" label="Y" min={0} onChange={onFieldChange} />
                <NumberProperty field={field} property="width" label="Width" min={20} onChange={onFieldChange} />
                <NumberProperty field={field} property="height" label="Height" min={20} onChange={onFieldChange} />
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-5 text-center text-xs leading-relaxed text-muted-foreground">
            Click a text field to reveal typography, data source, and geometry controls.
          </div>
        )}

        {qr.enabled && (
          <div className={`${field ? "mt-5" : "mt-4"} border-t pt-4`}>
            <div className="mb-3">
              <p className="text-sm font-medium">QR overlay</p>
              <p className="text-xs text-muted-foreground">Values use original image pixels.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["x", "y", "size"] as const).map((property) => (
                <div key={property} className="space-y-1.5">
                  <Label htmlFor={`qr-${property}`} className="text-xs uppercase">{property}</Label>
                  <Input
                    id={`qr-${property}`}
                    type="number"
                    min={property === "size" ? 40 : 0}
                    max={property === "size" ? 400 : undefined}
                    value={Math.round(qr[property])}
                    onChange={(event) =>
                      onQrChange({ ...qr, [property]: Number(event.target.value) || 0 })
                    }
                    className="h-9 px-2"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
