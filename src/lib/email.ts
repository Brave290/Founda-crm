import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export function normalizeSmtp(raw: any): SmtpConfig | null {
  if (!raw || !raw.user || !raw.pass) return null;
  return {
    host: String(raw.host || "smtp.gmail.com"),
    port: Number(raw.port) || 587,
    user: String(raw.user),
    pass: String(raw.pass),
  };
}

export async function sendMail(
  cfg: SmtpConfig,
  opts: { to: string; subject: string; text: string }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
  });
  await transport.sendMail({
    from: `"Founda Agent" <${cfg.user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}
