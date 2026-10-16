import { Email } from "@convex-dev/auth/providers/Email";

export function emailCode(id: string) {
  return Email({
    id,
    maxAge: 15 * 60,
    async generateVerificationToken() {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
    },
    async sendVerificationRequest({ identifier, token }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM,
          to: identifier,
          subject: "Votre code Alloo",
          text: `Votre code Alloo : ${token}\nValable 15 minutes. Si vous n’avez rien demandé, ignorez ce message.`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
    },
  });
}
