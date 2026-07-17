"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { lockDueFixtures } from "@/lib/scoring";
import { sendEmail, generateVerificationCode } from "@/lib/email";
import { Confidence } from "@prisma/client";

const predictionSchema = z.object({
  fixtureId: z.string().min(1),
  side: z.coerce.number().int().min(1).max(2),
  confidence: z.nativeEnum(Confidence).default("LOW"),
});

export async function submitPrediction(formData: FormData) {
  const session = await requireUser();
  const parsed = predictionSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    side: formData.get("side"),
    confidence: formData.get("confidence") ?? "LOW",
  });
  if (!parsed.success) return { error: "Invalid prediction" };
  const { fixtureId, side, confidence } = parsed.data;

  await lockDueFixtures();

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return { error: "Fixture not found" };
  if (fixture.isPlaceholder) {
    return { error: "Participants for this match aren't decided yet" };
  }
  if (fixture.status !== "SCHEDULED" || fixture.lockTime <= new Date()) {
    return { error: "Predictions are locked for this match" };
  }

  await prisma.prediction.upsert({
    where: {
      userId_fixtureId: { userId: session.user.id, fixtureId },
    },
    create: {
      userId: session.user.id,
      fixtureId,
      predictedSide: side,
      confidence,
    },
    update: { predictedSide: side, confidence },
  });

  revalidatePath("/fixtures");
  revalidatePath("/");
  revalidatePath("/predictions");
  return { success: true };
}

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "opshub.com")
  .toLowerCase()
  .replace(/^@/, "");

function isOfficeEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function registerUser(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  if (!isOfficeEmail(normalizedEmail)) {
    return { error: `Please use your office email (@${ALLOWED_DOMAIN})` };
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing?.emailVerified) {
    return { error: "An account with this email already exists" };
  }

  const isFirstUser = (await prisma.user.count()) === 0;
  const passwordHash = await bcrypt.hash(password, 10);
  const code = generateVerificationCode();
  const verificationExpires = new Date(Date.now() + 15 * 60_000);

  if (existing) {
    // Unverified account re-registering: update details, issue a fresh code.
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, passwordHash, verificationCode: code, verificationExpires },
    });
  } else {
    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: isFirstUser ? "ADMIN" : "USER", // first registered user becomes admin
        verificationCode: code,
        verificationExpires,
      },
    });
  }

  try {
    await sendEmail(
      normalizedEmail,
      "Your Sports Day League verification code",
      `Hi ${name},\n\nYour verification code is: ${code}\n\nIt expires in 15 minutes.\n\n— Sports Day Prediction League`
    );
  } catch (error) {
    console.error("Verification email failed:", error);
    return { error: "Could not send the verification email. Ask the admin to check email settings." };
  }

  return { pendingVerification: true };
}

export async function verifyEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Account not found — register again" };
  if (user.emailVerified) return { success: true };
  if (!user.verificationCode || !user.verificationExpires) {
    return { error: "No pending verification — register again" };
  }
  if (user.verificationExpires < new Date()) {
    return { error: "Code expired — use “Resend code”" };
  }
  if (user.verificationCode !== code) {
    return { error: "Incorrect code, try again" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verificationCode: null,
      verificationExpires: null,
    },
  });
  return { success: true };
}

export async function resendVerificationCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    return { error: "Nothing to verify for this email" };
  }

  const code = generateVerificationCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationCode: code,
      verificationExpires: new Date(Date.now() + 15 * 60_000),
    },
  });
  try {
    await sendEmail(
      email,
      "Your Sports Day League verification code",
      `Your new verification code is: ${code}\n\nIt expires in 15 minutes.`
    );
  } catch (error) {
    console.error("Verification email failed:", error);
    return { error: "Could not send the email — try again later" };
  }
  return { success: true };
}

export async function markNotificationsRead() {
  const session = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}
