import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CandidateSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    role: { type: String, default: "" },
    organization: { type: String, default: "" },
    department: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

CandidateSchema.index({ eventId: 1, email: 1 });
CandidateSchema.index({ eventId: 1, name: 1 });

export type CandidateDocument = InferSchemaType<typeof CandidateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Candidate: Model<CandidateDocument> =
  mongoose.models.Candidate || mongoose.model<CandidateDocument>("Candidate", CandidateSchema);
