import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { JOB_STATUSES } from "@/lib/types";

const GenerationBatchSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: JOB_STATUSES, default: "QUEUED" },
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const GenerationJobSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "GenerationBatch", required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    certificateId: { type: Schema.Types.ObjectId, ref: "Certificate", required: true },
    status: { type: String, enum: JOB_STATUSES, default: "QUEUED" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

GenerationJobSchema.index({ status: 1, lockedAt: 1, createdAt: 1 });
GenerationJobSchema.index({ batchId: 1, status: 1 });

export type GenerationBatchDocument = InferSchemaType<typeof GenerationBatchSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type GenerationJobDocument = InferSchemaType<typeof GenerationJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const GenerationBatch: Model<GenerationBatchDocument> =
  mongoose.models.GenerationBatch ||
  mongoose.model<GenerationBatchDocument>("GenerationBatch", GenerationBatchSchema);

export const GenerationJob: Model<GenerationJobDocument> =
  mongoose.models.GenerationJob ||
  mongoose.model<GenerationJobDocument>("GenerationJob", GenerationJobSchema);
