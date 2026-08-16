import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const FeedbackSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    candidateEmail: { type: String, required: true, lowercase: true, trim: true },
    candidateName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    remark: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

FeedbackSchema.index({ eventId: 1, candidateId: 1 }, { unique: true });
FeedbackSchema.index({ eventId: 1, candidateEmail: 1 });
FeedbackSchema.index({ eventId: 1, rating: -1 });

export type FeedbackDocument = InferSchemaType<typeof FeedbackSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Feedback: Model<FeedbackDocument> =
  mongoose.models.Feedback || mongoose.model<FeedbackDocument>("Feedback", FeedbackSchema);
