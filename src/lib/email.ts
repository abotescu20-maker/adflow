// Server-only email sending via the Resend REST API (P4 email leg).
// No SDK dependency — a single fetch. Configuration:
//   RESEND_API_KEY  — required to actually send; when absent every send is a
//                     silent no-op so the in-app notification path never breaks.
//   EMAIL_FROM      — sender; defaults to Resend's shared onboarding domain
//                     until the client's own domain is verified (see contract
//                     reserves: domain arrives later, swap this env var only).

const FROM_FALLBACK = "Blackframe <onboarding@resend.dev>";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || input.to.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || FROM_FALLBACK,
        to: input.to.slice(0, 50),
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      console.error("email send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("email send error:", e);
    return false;
  }
}

// Minimal on-brand template: black, monospace, no images (deliverability).
export function feedbackEmailHtml(opts: {
  title: string;
  guestName: string;
  assetName: string;
  body: string;
  linkUrl: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="margin:0;background:#000;padding:32px 16px;font-family:'Courier New',ui-monospace,monospace;color:#ededed">
  <div style="max-width:520px;margin:0 auto;border:1px solid #2a2a2a;border-radius:12px;padding:28px;background:#0f0f0f">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;color:#8a8a8a">BLACKFRAME</p>
    <h1 style="margin:0 0 16px;font-size:18px;color:#ededed">${esc(opts.title)}</h1>
    <p style="margin:0 0 6px;font-size:13px;color:#b4b4b4">Material: <strong style="color:#ededed">${esc(opts.assetName)}</strong></p>
    <p style="margin:0 0 16px;font-size:13px;color:#b4b4b4">De la: <strong style="color:#ededed">${esc(opts.guestName)}</strong></p>
    <div style="border-left:3px solid #6366f1;padding:10px 14px;margin:0 0 20px;background:#141414;font-size:13px;line-height:1.6;color:#ededed;white-space:pre-wrap">${esc(opts.body)}</div>
    <a href="${esc(opts.linkUrl)}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px">Deschide în Blackframe</a>
    <p style="margin:24px 0 0;font-size:11px;color:#8a8a8a">Primești acest email pentru că feedbackul e rutat către departamentul tău.</p>
  </div>
</body></html>`;
}
