import { z } from "zod";

export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const CERTIFICATE_STATUSES = ["NOT_GENERATED", "GENERATING", "PENDING", "GENERATED", "FAILED", "REVOKED"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const JOB_STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const FONT_FAMILIES = ["Inter", "Georgia", "Times New Roman", "Arial", "Courier New"] as const;
export const TEXT_ALIGNS = ["left", "center", "right"] as const;

export const templateFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text").default("text"),
  label: z.string().min(1),
  source: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  fontFamily: z.enum(FONT_FAMILIES).default("Inter"),
  fontSize: z.number().min(8).max(200).default(32),
  fontWeight: z.number().min(100).max(900).default(400),
  color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).default("#000000"),
  align: z.enum(TEXT_ALIGNS).default("center"),
  letterSpacing: z.number().default(0),
  lineHeight: z.number().min(0.8).max(3).default(1.2),
});

export const qrConfigSchema = z.object({
  enabled: z.boolean().default(false),
  x: z.number().default(40),
  y: z.number().default(40),
  size: z.number().min(40).max(400).default(120),
});

export const templateConfigSchema = z.object({
  fields: z.array(templateFieldSchema).default([]),
  qr: qrConfigSchema.default({ enabled: false, x: 40, y: 40, size: 120 }),
});

export type TemplateField = z.infer<typeof templateFieldSchema>;
export type TemplateConfig = z.infer<typeof templateConfigSchema>;
export type QrConfig = z.infer<typeof qrConfigSchema>;

export const BUILTIN_FIELD_SOURCES = [
  { source: "name", label: "Candidate Name" },
  { source: "email", label: "Email" },
  { source: "phone", label: "Phone" },
  { source: "role", label: "Role" },
  { source: "organization", label: "Organization" },
  { source: "department", label: "Department" },
  { source: "event_name", label: "Event Name" },
  { source: "event_date", label: "Event Date" },
  { source: "certificate_id", label: "Certificate ID" },
  { source: "organizer", label: "Organizer" },
] as const;
