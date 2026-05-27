import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";

/**
 * Auth.js (NextAuth v5) — passwordless magic-link login via Resend.
 *
 * Free readers only need the newsletter; an account is required to start the
 * 7-day website trial and to subscribe. Login is a one-time link emailed through
 * Resend (the same verified domain the newsletter sends from). Sessions are
 * stored in Postgres via the Prisma adapter.
 *
 * Env: AUTH_SECRET (required), RESEND_API_KEY (reused), AUTH_EMAIL_FROM (sender),
 * DATABASE_URL (Postgres). On Vercel AUTH_URL is auto-detected.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM || "The Leadership Letter <login@theleadershipletter.com>",
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  session: { strategy: "database" },
});
