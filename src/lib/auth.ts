import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

providers.push(
  Credentials({
    name: "Office Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").toLowerCase().trim();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;
      if (!user.emailVerified) return null; // must verify office email first

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      // Google sign-in is also restricted to the office domain.
      if (account?.provider === "google") {
        const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "opshub.com")
          .toLowerCase()
          .replace(/^@/, "");
        return Boolean(user.email?.toLowerCase().endsWith(`@${domain}`));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        // On Google sign-in, ensure a DB user exists.
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name ?? user.email.split("@")[0],
              image: user.image,
              emailVerified: new Date(), // Google already verified the address
            },
          });
        }
        token.userId = dbUser.id;
        token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as Role) ?? "USER";
      }
      return session;
    },
  },
});

/** Server-side guard: returns the session or throws. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}
