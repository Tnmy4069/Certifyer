import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CertificateTemplateSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
    backgroundKey: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    mimeType: { type: String, required: true },
    configuration: {
      fields: { type: Array, default: [] },
      qr: {
        enabled: { type: Boolean, default: false },
        x: { type: Number, default: 40 },
        y: { type: Number, default: 40 },
        size: { type: Number, default: 120 },
      },
    },
  },
  { timestamps: true }
);

export type CertificateTemplateDocument = InferSchemaType<typeof CertificateTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CertificateTemplate: Model<CertificateTemplateDocument> =
  mongoose.models.CertificateTemplate ||
  mongoose.model<CertificateTemplateDocument>("CertificateTemplate", CertificateTemplateSchema);
