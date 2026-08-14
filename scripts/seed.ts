import { config } from "dotenv";
config({ path: ".env.local" });

import sharp from "sharp";
import { connectDb } from "../src/lib/db";
import { getEnv } from "../src/lib/env";
import { hashPassword } from "../src/auth";
import { generateCertificateNumber } from "../src/lib/certificates/ids";
import { getStorage } from "../src/lib/storage";
import {
  Candidate,
  Certificate,
  CertificateTemplate,
  Event,
  User,
} from "../src/models";

async function createSampleBackground() {
  const width = 1600;
  const height = 1131;
  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="#0f172a" stroke-width="6"/>
    <rect x="60" y="60" width="${width - 120}" height="${height - 120}" fill="none" stroke="#94a3b8" stroke-width="2"/>
    <text x="50%" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#0f172a">Certificate of Achievement</text>
    <text x="50%" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#64748b">This is proudly presented to</text>
    <line x1="420" y1="520" x2="1180" y2="520" stroke="#cbd5e1" stroke-width="2"/>
    <text x="50%" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">for outstanding participation</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const env = getEnv();
  await connectDb();

  const passwordHash = await hashPassword(env.SUPER_ADMIN_PASSWORD);
  const admin = await User.findOneAndUpdate(
    { email: env.SUPER_ADMIN_EMAIL.toLowerCase() },
    {
      $set: {
        name: env.SUPER_ADMIN_NAME,
        email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: "SUPER_ADMIN",
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const event = await Event.findOneAndUpdate(
    { slug: "techfest-2026" },
    {
      $set: {
        name: "TechFest 2026",
        slug: "techfest-2026",
        description: "Annual technology festival showcasing innovation and collaboration.",
        organizerName: "XYZ Organization",
        eventDate: new Date("2026-08-14"),
        location: "Mumbai, India",
        status: "PUBLISHED",
        createdBy: admin!._id,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!admin || !event) {
    throw new Error("Failed to upsert admin or event");
  }

  const storage = getStorage();
  const background = await createSampleBackground();
  const backgroundKey = `events/${event._id}/backgrounds/seed.png`;
  await storage.put(backgroundKey, background, "image/png");

  const configuration = {
    fields: [
      {
        id: "candidate_name",
        type: "text",
        label: "Candidate Name",
        source: "name",
        x: 400,
        y: 420,
        width: 800,
        height: 80,
        fontFamily: "Georgia",
        fontSize: 48,
        fontWeight: 700,
        color: "#0f172a",
        align: "center",
        letterSpacing: 0,
        lineHeight: 1.2,
      },
      {
        id: "event_name",
        type: "text",
        label: "Event Name",
        source: "event_name",
        x: 400,
        y: 740,
        width: 800,
        height: 50,
        fontFamily: "Inter",
        fontSize: 28,
        fontWeight: 600,
        color: "#334155",
        align: "center",
        letterSpacing: 0,
        lineHeight: 1.2,
      },
      {
        id: "certificate_id",
        type: "text",
        label: "Certificate ID",
        source: "certificate_id",
        x: 80,
        y: 1000,
        width: 500,
        height: 40,
        fontFamily: "Courier New",
        fontSize: 18,
        fontWeight: 400,
        color: "#64748b",
        align: "left",
        letterSpacing: 1,
        lineHeight: 1.2,
      },
    ],
    qr: { enabled: true, x: 1400, y: 940, size: 120 },
  };

  await CertificateTemplate.findOneAndUpdate(
    { eventId: event!._id },
    {
      $set: {
        eventId: event!._id,
        backgroundKey,
        width: 1600,
        height: 1131,
        mimeType: "image/png",
        configuration,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const demoCandidates = [
    {
      name: "Tanmay Hirodkar",
      email: "tanmay@example.com",
      phone: "+91 90000 00001",
      role: "Participant",
      organization: "CodeLabs",
      department: "Engineering",
    },
    {
      name: "Aisha Khan",
      email: "aisha@example.com",
      phone: "+91 90000 00002",
      role: "Mentor",
      organization: "TechVerse",
      department: "AI",
    },
    {
      name: "Rohan Mehta",
      email: "rohan@example.com",
      phone: "+91 90000 00003",
      role: "Volunteer",
      organization: "Community Hub",
      department: "Operations",
    },
    {
      name: "Priya Sharma",
      email: "priya@example.com",
      phone: "+91 90000 00004",
      role: "Speaker",
      organization: "innovate.io",
      department: "Product",
    },
    {
      name: "Dev Patel",
      email: "dev@example.com",
      phone: "+91 90000 00005",
      role: "Winner",
      organization: "HackHouse",
      department: "Full Stack",
    },
  ];

  await Candidate.deleteMany({ eventId: event._id });
  await Certificate.deleteMany({ eventId: event._id });

  for (const row of demoCandidates) {
    const candidate = await Candidate.create({
      eventId: event._id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      organization: row.organization.trim(),
      department: row.department,
      metadata: {
        role: row.role,
        organization: row.organization.trim(),
        department: row.department,
      },
    });

    await Certificate.create({
      eventId: event._id,
      candidateId: candidate._id,
      certificateNumber: generateCertificateNumber(2026),
      status: "PENDING",
    });
  }

  event.candidateCount = demoCandidates.length;
  event.generatedCount = 0;
  event.failureCount = 0;
  await event.save();

  console.log("Seed complete");
  console.log(`Super admin: ${env.SUPER_ADMIN_EMAIL} / ${env.SUPER_ADMIN_PASSWORD}`);
  console.log(`Event: ${event.name} (/${event.slug})`);
  console.log(`Candidates: ${demoCandidates.length}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
