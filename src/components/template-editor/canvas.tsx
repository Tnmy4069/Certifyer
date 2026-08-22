"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { QrCode } from "lucide-react";
import type { QrConfig, TemplateField } from "@/lib/types";

const SAMPLE_VALUES: Record<string, string> = {
  name: "Alex Morgan",
  event_name: "Future Leaders Summit 2026",
  event_date: "August 14, 2026",
  certificate_id: "CERT-2026-00142",
  role: "Outstanding Participant",
  organization: "Northstar Labs",
  custom: "Custom value",
};

export const QR_SELECTION_ID = "__qr__";

type FieldInteraction = {
  target: "field";
  kind: "drag" | "resize";
  fieldId: string;
  startClientX: number;
  startClientY: number;
  initial: Pick<TemplateField, "x" | "y" | "width" | "height">;
};

type QrInteraction = {
  target: "qr";
  kind: "drag" | "resize";
  startClientX: number;
  startClientY: number;
  initial: Pick<QrConfig, "x" | "y" | "size">;
};

type Interaction = FieldInteraction | QrInteraction;

export function TemplateCanvas({
  backgroundUrl,
  originalWidth,
  originalHeight,
  fields,
  qr,
  zoom,
  selectedId,
  liveValues,
  onSelect,
  onFieldChange,
  onQrChange,
}: {
  backgroundUrl: string;
  originalWidth: number;
  originalHeight: number;
  fields: TemplateField[];
  qr: QrConfig;
  zoom: number;
  selectedId: string | null;
  liveValues?: Record<string, string>;
  onSelect: (id: string | null) => void;
  onFieldChange: (id: string, patch: Partial<TemplateField>) => void;
  onQrChange: (patch: Partial<QrConfig>) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(900);
  const [interaction, setInteraction] = useState<Interaction | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(viewport);
    setViewportWidth(viewport.clientWidth);
    return () => observer.disconnect();
  }, []);

  const baseWidth = Math.max(320, viewportWidth - 64);
  const displayWidth = baseWidth * (zoom / 100);
  const scale = displayWidth / originalWidth;
  const displayHeight = originalHeight * scale;

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0)),
    [fields, selectedId],
  );

  const qrSelected = selectedId === QR_SELECTION_ID;

  function beginFieldInteraction(
    event: ReactPointerEvent,
    field: TemplateField,
    kind: FieldInteraction["kind"],
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(field.id);
    setInteraction({
      target: "field",
      kind,
      fieldId: field.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: { x: field.x, y: field.y, width: field.width, height: field.height },
    });
  }

  function beginQrInteraction(event: ReactPointerEvent, kind: QrInteraction["kind"]) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(QR_SELECTION_ID);
    setInteraction({
      target: "qr",
      kind,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: { x: qr.x, y: qr.y, size: qr.size },
    });
  }

  function moveInteraction(event: ReactPointerEvent) {
    if (!interaction) return;
    const dx = (event.clientX - interaction.startClientX) / scale;
    const dy = (event.clientY - interaction.startClientY) / scale;

    if (interaction.target === "field") {
      if (interaction.kind === "drag") {
        onFieldChange(interaction.fieldId, {
          x: Math.max(0, Math.min(originalWidth - interaction.initial.width, interaction.initial.x + dx)),
          y: Math.max(0, Math.min(originalHeight - interaction.initial.height, interaction.initial.y + dy)),
        });
      } else {
        onFieldChange(interaction.fieldId, {
          width: Math.max(40, Math.min(originalWidth - interaction.initial.x, interaction.initial.width + dx)),
          height: Math.max(20, Math.min(originalHeight - interaction.initial.y, interaction.initial.height + dy)),
        });
      }
      return;
    }

    if (interaction.kind === "drag") {
      onQrChange({
        x: Math.max(0, Math.min(originalWidth - interaction.initial.size, interaction.initial.x + dx)),
        y: Math.max(0, Math.min(originalHeight - interaction.initial.size, interaction.initial.y + dy)),
      });
    } else {
      const nextSize = Math.max(
        40,
        Math.min(
          400,
          originalWidth - interaction.initial.x,
          originalHeight - interaction.initial.y,
          interaction.initial.size + Math.max(dx, dy),
        ),
      );
      onQrChange({ size: nextSize });
    }
  }

  return (
    <div
      ref={viewportRef}
      className="relative flex min-h-[360px] sm:min-h-[620px] items-start justify-center overflow-auto no-scrollbar rounded-xl border bg-slate-100/80 p-3 sm:p-8 shadow-inner dark:bg-slate-950/50"
      onPointerMove={moveInteraction}
      onPointerUp={() => setInteraction(null)}
      onPointerCancel={() => setInteraction(null)}
      onClick={() => onSelect(null)}
    >
      <div
        className="relative shrink-0 overflow-hidden bg-white bg-cover bg-center bg-no-repeat shadow-2xl ring-1 ring-black/10"
        style={{
          width: displayWidth,
          height: displayHeight,
          backgroundImage: `url("${backgroundUrl}")`,
        }}
        role="img"
        aria-label="Certificate template preview"
      >
        {sortedFields.map((field) => {
          const selected = field.id === selectedId;
          return (
            <div
              key={field.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${field.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(field.id);
              }}
              onPointerDown={(event) => beginFieldInteraction(event, field, "drag")}
              className={`group absolute select-none overflow-hidden border ${
                selected
                  ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500"
                  : "border-transparent hover:border-blue-400/70 hover:bg-blue-500/5"
              }`}
              style={{
                left: field.x * scale,
                top: field.y * scale,
                width: field.width * scale,
                height: field.height * scale,
                color: field.color,
                fontFamily: field.fontFamily,
                fontSize: field.fontSize * scale,
                fontWeight: field.fontWeight,
                letterSpacing: field.letterSpacing * scale,
                lineHeight: field.lineHeight,
                textAlign: field.align,
                cursor: interaction?.target === "field" && interaction.fieldId === field.id ? "grabbing" : "grab",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  field.align === "left" ? "flex-start" : field.align === "right" ? "flex-end" : "center",
                paddingInline: 2,
              }}
            >
              <span className="w-full truncate">
                {field.source === "custom" || field.source.startsWith("custom") || field.source === "static"
                  ? field.customText || field.label || "Custom Text"
                  : liveValues?.[field.source] ||
                    SAMPLE_VALUES[field.source] ||
                    field.customText ||
                    field.label}
              </span>
              {selected && (
                <>
                  <span className="pointer-events-none absolute -top-px left-1 rounded-b bg-blue-600 px-1.5 py-0.5 font-sans text-[9px] font-medium leading-none tracking-normal text-white">
                    {field.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Resize ${field.label}`}
                    onPointerDown={(event) => beginFieldInteraction(event, field, "resize")}
                    className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-blue-600 shadow"
                  />
                </>
              )}
            </div>
          );
        })}

        {qr.enabled && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Move verification QR code"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(QR_SELECTION_ID);
            }}
            onPointerDown={(event) => beginQrInteraction(event, "drag")}
            className={`absolute grid place-items-center border-2 border-dashed bg-white/90 text-slate-900 select-none ${
              qrSelected
                ? "border-blue-500 ring-1 ring-blue-500"
                : "border-slate-700 hover:border-blue-400"
            }`}
            style={{
              left: qr.x * scale,
              top: qr.y * scale,
              width: qr.size * scale,
              height: qr.size * scale,
              cursor: interaction?.target === "qr" && interaction.kind === "drag" ? "grabbing" : "grab",
              zIndex: qrSelected ? 2 : 1,
            }}
            title="Drag to reposition verification QR"
          >
            <QrCode style={{ width: "76%", height: "76%", pointerEvents: "none" }} strokeWidth={1.5} />
            <span className="pointer-events-none absolute -bottom-5 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-medium text-white">
              QR code
            </span>
            {qrSelected && (
              <button
                type="button"
                aria-label="Resize QR code"
                onPointerDown={(event) => beginQrInteraction(event, "resize")}
                className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-blue-600 shadow"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
