import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const EmailLogSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "Candidate", required: true },
    certificateId: { type: Schema.Types.ObjectId, ref: "Certificate", default: null },
    to: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["sent", "failed", "skipped"], default: "sent" },
    type: { type: String, default: "certificate_ready" },
    error: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EmailLogSchema.index({ eventId: 1, candidateId: 1, type: 1 });
EmailLogSchema.index({ eventId: 1, status: 1 });

export type EmailLogDocument = InferSchemaType<typeof EmailLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EmailLog: Model<EmailLogDocument> =
  mongoose.models.EmailLog || mongoose.model<EmailLogDocument>("EmailLog", EmailLogSchema);
