import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { track } from "@vercel/analytics/server";
import { db } from "@/lib/db";
import { buildSignInEmailHtml, buildSignInEmailText } from "@/lib/auth-email";

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
    // Google OAuth — one-tap sign-in, no email round-trip. The flow stays in the
    // current browser context (no email-app hop), so it also works from an iOS
    // "Add to Home Screen" web app where a magic link would land in the wrong
    // browser. allowDangerousEmailAccountLinking is safe here because Google
    // verifies email ownership: a reader who first used the magic link gets their
    // Google login linked to the same account instead of an OAuthAccountNotLinked
    // error.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM || "The Leadership Letter <login@theleadershipletter.com>",
      // Override the default Auth.js plain-blue-button email with a branded one
      // that matches the newsletter (parchment + serif + ink). Posts the email
      // directly to Resend's /emails endpoint.
      async sendVerificationRequest({ identifier: to, url, provider }) {
        const host = new URL(url).host;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: [to],
            subject: `Sign in to ${host}`,
            html: buildSignInEmailHtml({ to, url, host }),
            text: buildSignInEmailText({ to, url, host }),
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`Resend send failed (${res.status}): ${body}`);
        }

        // Analytics — fires once per dispatched magic-link. Email domain only
        // (no full address) so the funnel is queryable without storing PII.
        const domain = to.split("@")[1] || "unknown";
        await track("signin_started", { domain }).catch((err) =>
          console.error("[analytics] signin_started track failed", err),
        );
      },
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  // Long, sliding sessions so members rarely have to sign in again. Database
  // strategy keeps the session row authoritative (revocable); updateAge means we
  // only extend the expiry once a day rather than on every request.
  session: {
    strategy: "database",
    maxAge: 90 * 24 * 60 * 60, // 90 days
    updateAge: 24 * 60 * 60, // refresh expiry at most once per day
  },
});
