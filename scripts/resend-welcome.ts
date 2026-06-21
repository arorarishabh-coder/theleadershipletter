// One-shot retest of the welcome email pipeline against addresses that
// previously bounced or junked. Uses the deployed-style headers (List-Unsubscribe +
// List-Unsubscribe-Post) so we can verify that with DMARC + proper headers in
// place, Apple and Workspace will accept the message.

import "dotenv/config";
import { buildWelcomeEmailHtml, buildWelcomeEmailText, WELCOME_SUBJECT, unsubscribeUrlFor } from "@/lib/welcome-email";

const TARGETS = ["risharora@icloud.com", "rajinderbagga@blaids.com"];

async function main() {
  const siteUrl = process.env.SITE_URL || "https://theleadershipletter.com";
  for (const to of TARGETS) {
    const unsubscribeUrl = unsubscribeUrlFor(to, siteUrl);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: [to],
        subject: WELCOME_SUBJECT,
        html: buildWelcomeEmailHtml({ to, siteUrl }),
        text: buildWelcomeEmailText({ to, siteUrl }),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    const j: { id?: string; message?: string } = await res.json().catch(() => ({}));
    console.log(`${to} | ${res.status} | ${j.id || JSON.stringify(j).slice(0, 200)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
