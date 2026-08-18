import mongoose from "mongoose";
import { z } from "zod";
import { hashPassword, requireSuperAdmin } from "@/auth";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { User } from "@/models";

type Params = { params: Promise<{ id: string }> };

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const data = resetPasswordSchema.parse(await parseJson<unknown>(request));

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    await connectDb();
    const user = await User.findById(id).select("name email role");
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (user.role !== "ADMIN") {
      throw new AppError("Only admin account passwords can be reset here", 403, "FORBIDDEN");
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(data.password) } }
    );

    return jsonOk({
      message: `Password reset for ${user.email}`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
