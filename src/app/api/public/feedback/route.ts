import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { AuditEvent, Candidate, Event, Feedback } from "@/models";

const feedbackSchema = z.object({
  eventId: z.string().min(1),
  candidateId: z.string().min(1),
  email: z.string().email(),
  rating: z.number().int().min(1).max(5),
  remark: z.string().max(1000).default(""),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-feedback:${ip}`, 30, 60_000);
    if (!limited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const body = feedbackSchema.parse(await parseJson(request));
    await connectDb();

    // Verify event
    const event = await Event.findOne({ _id: body.eventId });
    if (!event) throw new AppError("Event not found.", 404, "NOT_FOUND");

    // Verify candidate
    const candidate = await Candidate.findOne({
      _id: body.candidateId,
      eventId: event._id,
      email: body.email.toLowerCase(),
    });
    if (!candidate) throw new AppError("Candidate not found.", 404, "NOT_FOUND");

    // Upsert feedback
    const feedback = await Feedback.findOneAndUpdate(
      { eventId: event._id, candidateId: candidate._id },
      {
        $set: {
          candidateEmail: candidate.email.toLowerCase(),
          candidateName: candidate.name,
          rating: body.rating,
          remark: body.remark.trim(),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Audit log
    await AuditEvent.create({
      eventId: event._id,
      actorType: "CANDIDATE",
      actorId: candidate.email,
      action: "candidate.feedback_submitted",
      metadata: {
        rating: body.rating,
        hasRemark: Boolean(body.remark.trim()),
      },
    });

    return jsonOk({
      ok: true,
      feedback: {
        rating: feedback.rating,
        remark: feedback.remark,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
