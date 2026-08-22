import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CERTIFICATE_STATUSES } from "@/lib/types";

const CertificateSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    certificateNumber: { type: String, required: true, unique: true },
    pngKey: { type: String, default: null },
    pdfKey: { type: String, default: null },
    status: { type: String, enum: CERTIFICATE_STATUSES, default: "NOT_GENERATED" },
    issuedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    downloadCount: { type: Number, default: 0 },
    verificationCount: { type: Number, default: 0 },
    failureReason: { type: String, default: null },
    lastGeneratedAt: { type: Date, default: null },
    generatingAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CertificateSchema.index({ eventId: 1, status: 1 });
CertificateSchema.index({ eventId: 1, candidateId: 1 }, { unique: true });
CertificateSchema.index({ eventId: 1, downloadCount: 1 }); // dashboard downloaded count
CertificateSchema.index({ eventId: 1, verificationCount: 1 }); // dashboard verification count

export type CertificateDocument = InferSchemaType<typeof CertificateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Certificate: Model<CertificateDocument> =
  mongoose.models.Certificate || mongoose.model<CertificateDocument>("Certificate", CertificateSchema);
