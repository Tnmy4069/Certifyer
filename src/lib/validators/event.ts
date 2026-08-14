import { z } from "zod";
import { EVENT_STATUSES } from "@/lib/types";

export const createEventSchema = z.object({
  name: z.string().min(2, "Event name is required").max(120),
  description: z.string().max(2000).optional().default(""),
  organizerName: z.string().min(2, "Organizer is required").max(120),
  eventDate: z.string().min(1, "Event date is required"),
  location: z.string().max(200).optional().default(""),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")
    .optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(EVENT_STATUSES).optional(),
  linkedinOrganizationId: z.string().max(80).optional(),
  linkedinCertificationName: z.string().max(200).optional(),
});

export const importMappingSchema = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().optional(),
  role: z.string().optional(),
  organization: z.string().optional(),
  department: z.string().optional(),
  extras: z.record(z.string(), z.string()).optional().default({}),
});

export const candidateImportSchema = z.object({
  mapping: importMappingSchema,
  rows: z.array(z.record(z.string(), z.string())).min(1),
});
