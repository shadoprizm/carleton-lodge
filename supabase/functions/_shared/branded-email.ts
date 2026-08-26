export type EmailDetail = {
  label: string;
  value: string;
};

export type BrandedEmailInput = {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  details?: EmailDetail[];
  cta?: {
    label: string;
    url: string;
  };
  preferenceLink?: {
    lead: string;
    label: string;
    url: string;
  };
  closing?: string;
  siteUrl: string;
};

export type BrandedEmail = {
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderMultilineText = (value: string) =>
  escapeHtml(value).replaceAll("\n", "<br>");

export const renderBrandedEmail = ({
  subject,
  preheader,
  eyebrow,
  heading,
  paragraphs,
  details = [],
  cta,
  preferenceLink,
  closing = "Fraternally,\nCarleton Lodge No. 465",
  siteUrl,
}: BrandedEmailInput): BrandedEmail => {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const logoUrl = `${normalizedSiteUrl}/Screenshot_2026-03-01_at_08.13.26.png`;

  const detailText = details.map(({ label, value }) => `${label}: ${value}`);
  const text = [
    heading,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...detailText,
    ...(details.length ? [""] : []),
    ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []),
    ...(preferenceLink
      ? [
        `${preferenceLink.lead} ${preferenceLink.label}: ${preferenceLink.url}`,
        "",
      ]
      : []),
    closing,
    "",
    `Carleton Lodge No. 465 · Carp, Ontario · ${normalizedSiteUrl}`,
  ].join("\n").trim();

  const detailRows = details.map(({ label, value }, index) => `
    <tr>
      <td class="email-detail-label" style="padding:${
    index === 0 ? "0" : "14px 0 0"
  };vertical-align:top;width:140px;color:#64748b;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:20px;text-transform:uppercase;letter-spacing:0.6px;">
        ${escapeHtml(label)}
      </td>
      <td class="email-detail-value" style="padding:${
    index === 0 ? "0" : "14px 0 0"
  };vertical-align:top;color:#1e293b;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;">
        ${renderMultilineText(value)}
      </td>
    </tr>
  `).join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light only">
    <title>${escapeHtml(subject)}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-card { border-radius: 0 !important; }
        .email-header { padding: 28px 22px 24px !important; }
        .email-body { padding: 30px 22px 28px !important; }
        .email-footer { padding: 24px 22px 30px !important; }
        .email-heading { font-size: 29px !important; line-height: 35px !important; }
        .email-detail-label,
        .email-detail-value {
          display: block !important;
          width: 100% !important;
        }
        .email-detail-value { padding-top: 3px !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;color:#334155;">
    <!-- Carleton Lodge standard transactional email template v1 -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
      &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:34px 12px;">
          <table class="email-shell email-card" role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px;max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 30px rgba(15,23,42,0.08);overflow:hidden;">
            <tr>
              <td class="email-header" style="padding:34px 42px 30px;background:#0f172a;border-bottom:4px solid #d97706;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="76" style="width:76px;vertical-align:middle;">
                      <img src="${
    escapeHtml(logoUrl)
  }" width="64" height="68" alt="Carleton Lodge No. 465" style="display:block;width:64px;height:68px;object-fit:contain;border:0;">
                    </td>
                    <td style="vertical-align:middle;padding-left:15px;">
                      <div style="color:#fef3c7;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:700;line-height:28px;">
                        Carleton Lodge No. 465
                      </div>
                      <div style="padding-top:5px;color:#fbbf24;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.8px;text-transform:uppercase;">
                        A.F. &amp; A.M. · Warranted 1904
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-body" style="padding:40px 42px 38px;background:#ffffff;">
                <div style="color:#b45309;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px;letter-spacing:1.7px;text-transform:uppercase;">
                  ${escapeHtml(eyebrow)}
                </div>
                <h1 class="email-heading" style="margin:9px 0 20px;color:#0f172a;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;line-height:41px;">
                  ${escapeHtml(heading)}
                </h1>
                ${
    paragraphs.map((paragraph) => `
                  <p style="margin:0 0 16px;color:#475569;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;">
                    ${renderMultilineText(paragraph)}
                  </p>
                `).join("")
  }
                ${
    details.length
      ? `
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:24px 0 0;padding:20px;background:#f8fafc;border-left:4px solid #d97706;border-radius:7px;">
                    ${detailRows}
                  </table>
                `
      : ""
  }
                ${
    cta
      ? `
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 4px;">
                    <tr>
                      <td bgcolor="#d97706" style="border-radius:6px;">
                        <a class="email-button" href="${
        escapeHtml(cta.url)
      }" style="display:inline-block;padding:14px 24px;border:1px solid #d97706;border-radius:6px;background:#d97706;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;">
                          ${escapeHtml(cta.label)}
                        </a>
                      </td>
                    </tr>
                  </table>
                `
      : ""
  }
                ${
    preferenceLink
      ? `
                <p style="margin:20px 0 0;color:#64748b;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;">
                  ${escapeHtml(preferenceLink.lead)}
                  <a href="${
        escapeHtml(preferenceLink.url)
      }" style="color:#475569;text-decoration:underline;">${
        escapeHtml(preferenceLink.label)
      }</a>.
                </p>
                `
      : ""
  }
                <p style="margin:28px 0 0;color:#475569;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">
                  ${renderMultilineText(closing)}
                </p>
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:26px 42px 32px;background:#0f172a;text-align:center;">
                <div style="color:#fef3c7;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;line-height:22px;">
                  Carleton Lodge No. 465 · Carp, Ontario
                </div>
                <div style="padding-top:6px;color:#cbd5e1;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;">
                  Grand Lodge of Canada in the Province of Ontario
                </div>
                <div style="padding-top:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;">
                  This automated message was sent by the Carleton Lodge website.<br>
                  <a href="${
    escapeHtml(normalizedSiteUrl)
  }" style="color:#fbbf24;text-decoration:underline;">carpmasons.ca</a>
                  &nbsp;·&nbsp; Carpe Diem
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};
