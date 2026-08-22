export type CertificateEmailData = {
  candidateName: string;
  eventName: string;
  organizerName: string;
  certificateNumber: string;
  verifyUrl: string;   // /verify/CERT-NUMBER — direct download & verify page
  publicUrl: string;   // /public/[eventSlug] — event page (fallback)
};

export function buildCertificateReadyEmail(data: CertificateEmailData): { subject: string; html: string; text: string } {
  const { candidateName, eventName, organizerName, certificateNumber, verifyUrl, publicUrl } = data;

  const subject = `Your certificate for "${eventName}" is ready 🎓`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#c7d2fe;letter-spacing:2px;text-transform:uppercase;">Certify</p>
              <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Your Certificate is Ready 🎓</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi <strong>${candidateName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Congratulations! Your certificate for <strong style="color:#111827;">${eventName}</strong>
                organized by <strong style="color:#111827;">${organizerName}</strong> is now ready.
                Click below to download and verify it instantly.
              </p>
              <!-- Primary CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 12px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.3px;">
                      📥 Download &amp; Verify Certificate
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <a href="${publicUrl}"
                       style="font-size:13px;color:#6366f1;text-decoration:underline;">
                      Or visit the event page →
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Certificate Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Certificate Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">Certificate No.</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">
                          <a href="${verifyUrl}" style="color:#4f46e5;text-decoration:none;">${certificateNumber}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Event</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${eventName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Issued by</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${organizerName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Verify link</td>
                        <td style="padding:4px 0;font-size:12px;color:#6366f1;word-break:break-all;">
                          <a href="${verifyUrl}" style="color:#6366f1;">${verifyUrl}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                This link lets you download your certificate as PDF or PNG and share your verified credential directly.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                Sent via <strong>Certify</strong> &middot; Certificate Management Platform<br/>
                If you did not expect this email, please ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${candidateName},

Congratulations! Your certificate for "${eventName}" organized by ${organizerName} is ready.

Certificate Number: ${certificateNumber}

Download & Verify your certificate directly:
${verifyUrl}

Or visit the event page: ${publicUrl}

If you did not expect this email, please ignore it.
`;

  return { subject, html, text };
}