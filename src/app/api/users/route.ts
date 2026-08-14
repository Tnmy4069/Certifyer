import { z } from "zod";
import { hashPassword, requireSuperAdmin } from "@/auth";
import { AppError, jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { User } from "@/models";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    await connectDb();
    const users = await User.find()
      .select("name email role createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return jsonOk({
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const data = createUserSchema.parse(await parseJson<unknown>(request));
    await connectDb();

    const email = data.email.toLowerCase();
    if (await User.exists({ email })) {
      throw new AppError("A user with this email already exists", 409, "EMAIL_EXISTS");
    }

    const user = await User.create({
      name: data.name,
      email,
      passwordHash: await hashPassword(data.password),
      role: "ADMIN",
    });

    return jsonCreated({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
