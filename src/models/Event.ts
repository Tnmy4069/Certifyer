import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { EVENT_STATUSES } from "@/lib/types";
import "./User";

const EventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    organizerName: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    location: { type: String, default: "" },
    logoKey: { type: String, default: null },
    status: { type: String, enum: EVENT_STATUSES, default: "DRAFT" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    candidateCount: { type: Number, default: 0 },
    generatedCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    verificationCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    // LinkedIn sharing
    linkedinOrganizationId: { type: String, default: "" },
    linkedinCertificationName: { type: String, default: "" },
  },
  { timestamps: true }
);

EventSchema.index({ createdBy: 1, createdAt: -1 });
EventSchema.index({ status: 1 });

export type EventDocument = InferSchemaType<typeof EventSchema> & { _id: mongoose.Types.ObjectId };

export const Event: Model<EventDocument> =
  mongoose.models.Event || mongoose.model<EventDocument>("Event", EventSchema);
