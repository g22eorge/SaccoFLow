import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/src/server/db/prisma";

const hasSmtpConfig =
  Boolean(process.env.SMTP_HOST) &&
  Boolean(process.env.SMTP_PORT) &&
  Boolean(process.env.SMTP_USER) &&
  Boolean(process.env.SMTP_PASS) &&
  Boolean(process.env.SMTP_FROM);

const authSecret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("BETTER_AUTH_SECRET must be set in production");
}

export const auth = betterAuth({
  secret: authSecret ?? "dev-only-secret-change-this-before-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      if (hasSmtpConfig) {
        const nodemailer = await import("nodemailer");
        const port = Number(process.env.SMTP_PORT ?? "587");
        const secure = process.env.SMTP_SECURE === "true" || port === 465;
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transport.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject: "Reset your password",
          text: `Use this link to reset your password: ${url}`,
          html: `<p>Use this link to reset your password:</p><p><a href=\"${url}\">${url}</a></p>`,
        });
        return;
      }

      if (process.env.NODE_ENV === "production") {
        throw new Error("Password reset email is not configured (missing SMTP settings)");
      }

      console.info(
        `[DEV] Password reset for ${user.email}. Open this URL: ${url}`,
      );
    },
  },
  basePath: "/api/auth",
});
