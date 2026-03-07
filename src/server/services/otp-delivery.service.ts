const hasEmailConfig = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );

const hasSmsConfig = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
  );

const sendEmailCode = async (destination: string, code: string) => {
  if (!hasEmailConfig()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured for production OTP delivery");
    }
    console.info(`[2FA] EMAIL code for ${destination}: ${code}`);
    return;
  }

  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: destination,
    subject: "Your SACCOFlow sign-in code",
    text: `Your SACCOFlow verification code is ${code}. It expires in 5 minutes.`,
    html: `<p>Your SACCOFlow verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes.</p>`,
  });
};

const sendSmsCode = async (destination: string, code: string) => {
  if (!hasSmsConfig()) {
    throw new Error("SMS delivery not configured. Use email channel or set Twilio env vars.");
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_FROM as string;

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: destination,
    From: from,
    Body: `Your SACCOFlow verification code is ${code}. It expires in 5 minutes.`,
  });
  const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Twilio OTP delivery failed: ${response.status} ${payload}`);
  }
};

export const OtpDeliveryService = {
  hasEmailConfig,
  hasSmsConfig,
  async sendCode(input: {
    channel: "EMAIL" | "SMS";
    destination: string;
    code: string;
  }) {
    if (input.channel === "SMS") {
      await sendSmsCode(input.destination, input.code);
      return;
    }

    await sendEmailCode(input.destination, input.code);
  },
};
