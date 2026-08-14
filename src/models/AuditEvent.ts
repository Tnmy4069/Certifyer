import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AuditEventSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null, index: true },
    certificateId: { type: Schema.Types.ObjectId, ref: "Certificate", default: null },
    actorType: { type: String, enum: ["ADMIN", "CANDIDATE", "SYSTEM", "PUBLIC"], required: true },
    actorId: { type: String, default: null },
    action: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditEventSchema.index({ action: 1, createdAt: -1 });

export type AuditEventDocument = InferSchemaType<typeof AuditEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditEvent: Model<AuditEventDocument> =
  mongoose.models.AuditEvent || mongoose.model<AuditEventDocument>("AuditEvent", AuditEventSchema);
