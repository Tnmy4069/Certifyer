import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { absoluteUrl, formatDate } from "@/lib/utils";
import type { TemplateConfig, TemplateField } from "@/lib/types";

export type RenderContext = {
  candidate: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
    organization?: string;
    department?: string;
    metadata?: Record<string, unknown>;
  };
  event: {
    name: string;
    organizerName: string;
    eventDate: Date | string;
  };
  certificateNumber: string;
  baseUrl?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function resolveFieldValue(source: string, ctx: RenderContext, customText?: string): string {
  if (source === "custom" || source.startsWith("custom") || source === "static") {
    return customText || "";
  }

  const metadata = ctx.candidate.metadata || {};
  const map: Record<string, string> = {
    name: ctx.candidate.name,
    candidate_name: ctx.candidate.name,
    email: ctx.candidate.email,
    phone: ctx.candidate.phone || "",
    role: ctx.candidate.role || String(metadata.role || ""),
    organization: ctx.candidate.organization || String(metadata.organization || ""),
    department: ctx.candidate.department || String(metadata.department || ""),
    event_name: ctx.event.name,
    event_date: formatDate(ctx.event.eventDate),
    certificate_id: ctx.certificateNumber,
    organizer: ctx.event.organizerName,
  };

  if (map[source] !== undefined) return map[source];
  if (metadata[source] !== undefined && metadata[source] !== null) return String(metadata[source]);
  return customText || "";
}

let cachedFontBase64: string | null = null;
async function getFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      const fontData = fs.readFileSync(fontPath);
      cachedFontBase64 = fontData.toString("base64");
      return cachedFontBase64;
    }
    
    // Fallback for Vercel production if file is not bundled
    const res = await fetch("https://cdn.jsdelivr.net/gh/rsms/inter@master/docs/font-files/Inter-Regular.ttf");
    if (!res.ok) throw new Error(`Failed to fetch font: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    cachedFontBase64 = Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    console.error("Failed to load font:", err);
    cachedFontBase64 = "";
  }
  return cachedFontBase64;
}

function fontFamilyCss(family: string): string {
  switch (family) {
    case "Georgia":
      return "Georgia, Inter, serif";
    case "Times New Roman":
      return "'Times New Roman', Inter, Times, serif";
    case "Courier New":
      return "'Courier New', Inter, Courier, monospace";
    case "Arial":
      return "Arial, Inter, Helvetica, sans-serif";
    default:
      return "Inter, Arial, Helvetica, sans-serif";
  }
}

function textAnchor(align: TemplateField["align"]): string {
  if (align === "left") return "start";
  if (align === "right") return "end";
  return "middle";
}

function textX(field: TemplateField): number {
  if (field.align === "left") return field.x;
  if (field.align === "right") return field.x + field.width;
  return field.x + field.width / 2;
}

function buildOverlaySvg(
  width: number,
  height: number,
  fields: TemplateField[],
  ctx: RenderContext,
  qrDataUrl?: string | null,
  qr?: TemplateConfig["qr"],
  fontBase64?: string
): string {
  const styleNode = fontBase64
    ? `<style>
      @font-face {
        font-family: 'Inter';
        src: url(data:font/ttf;base64,${fontBase64});
      }
    </style>`
    : "";

  const textNodes = fields
    .map((field) => {
      const resolved = resolveFieldValue(field.source, ctx, field.customText);
      const value = escapeXml(resolved || field.customText || field.label);
      const x = textX(field);
      const y = field.y + field.fontSize;
      return `<text x="${x}" y="${y}" text-anchor="${textAnchor(field.align)}"
        font-family="${escapeXml(fontFamilyCss(field.fontFamily))}"
        font-size="${field.fontSize}"
        font-weight="${field.fontWeight}"
        fill="${escapeXml(field.color)}"
        letter-spacing="${field.letterSpacing}"
        style="dominant-baseline: alphabetic;">${value}</text>`;
    })
    .join("\n");

  const qrNode =
    qr?.enabled && qrDataUrl
      ? `<image href="${qrDataUrl}" x="${qr.x}" y="${qr.y}" width="${qr.size}" height="${qr.size}" />`
      : "";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${styleNode}${textNodes}${qrNode}</svg>`;
}

export async function renderCertificatePng(options: {
  background: Buffer;
  width: number;
  height: number;
  configuration: TemplateConfig;
  context: RenderContext;
}): Promise<Buffer> {
  const { background, width, height, configuration, context } = options;

  let qrDataUrl: string | null = null;
  if (configuration.qr?.enabled) {
    const verifyUrl = context.baseUrl
      ? `${context.baseUrl.replace(/\/$/, "")}/verify/${context.certificateNumber}`
      : absoluteUrl(`/verify/${context.certificateNumber}`);
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: configuration.qr.size * 2,
      errorCorrectionLevel: "M",
    });
  }

  const fontBase64 = await getFontBase64();
  const svg = buildOverlaySvg(width, height, configuration.fields || [], context, qrDataUrl, configuration.qr, fontBase64);

  return sharp(background)
    .resize(width, height, { fit: "fill" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function renderCertificatePdf(png: Buffer, width: number, height: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width, height });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
