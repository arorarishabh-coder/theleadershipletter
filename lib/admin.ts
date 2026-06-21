import { auth } from "@/auth";

// Admin gating. For MVP we don't expose role management UI; admins are listed
// in a comma-separated ADMIN_EMAILS env var (also set in Vercel). This avoids
// shipping a DB-migration just to flip a row. When/if we add a real admin
// console for managing other admins, switch to the User.role column.

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) throw new AdminRedirect("/signin?callbackUrl=/admin");
  const admins = adminEmails();
  if (!admins.has(email)) throw new AdminRedirect("/");
  return { email };
}

export class AdminRedirect extends Error {
  constructor(public readonly to: string) {
    super(`admin redirect to ${to}`);
  }
}
