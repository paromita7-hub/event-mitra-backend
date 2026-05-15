import nodemailer from "nodemailer";

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

const buildOtpTemplate = (otp: string, purpose: "email_verify" | "forgot_password") => {
  const heading =
    purpose === "forgot_password" ? "Reset your EventMitra password" : "Verify your EventMitra email";
  const description =
    purpose === "forgot_password"
      ? "Use this one-time password to continue resetting your password."
      : "Use this one-time password to verify your email address and finish creating your account.";

  return `
    <div style="font-family: Arial, sans-serif; background: #0f1221; padding: 32px; color: #ffffff;">
      <div style="max-width: 520px; margin: 0 auto; background: #171b2f; border-radius: 18px; padding: 32px;">
        <p style="margin: 0 0 8px; color: #7dd3fc; font-size: 14px; letter-spacing: 0.08em;">EVENTMITRA</p>
        <h1 style="margin: 0 0 12px; font-size: 28px;">${heading}</h1>
        <p style="margin: 0 0 24px; color: #cbd5e1; line-height: 1.6;">${description}</p>
        <div style="margin: 24px 0; padding: 18px 24px; border-radius: 14px; background: #0f172a; border: 1px solid #334155; text-align: center;">
          <p style="margin: 0 0 8px; color: #94a3b8; font-size: 13px;">Your 6-digit OTP</p>
          <p style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: 0.3em;">${otp}</p>
        </div>
        <p style="margin: 0 0 12px; color: #cbd5e1;">This OTP expires in 10 minutes.</p>
        <p style="margin: 0; color: #94a3b8; font-size: 13px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    </div>
  `;
};

export const sendOtpEmail = async (
  to: string,
  otp: string,
  purpose: "email_verify" | "forgot_password",
): Promise<void> => {
  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP credentials are missing. Set SMTP_USER and SMTP_PASS in backend/.env.");
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || smtpUser,
    to,
    subject: purpose === "forgot_password" ? "EventMitra password reset OTP" : "EventMitra email verification OTP",
    text: `Your EventMitra OTP is ${otp}. It expires in 10 minutes.`,
    html: buildOtpTemplate(otp, purpose),
  });
};
