import { renderBrandedEmail } from "./branded-email.ts";

export type ExternalLinkAlertEmailInput = {
  linkName: string;
  targetUrl: string;
  failureReason: string;
  detectedAt: string;
  siteUrl: string;
};

export const renderExternalLinkAlertEmail = ({
  linkName,
  targetUrl,
  failureReason,
  detectedAt,
  siteUrl,
}: ExternalLinkAlertEmailInput) => {
  const linksUrl = `${siteUrl.replace(/\/$/, "")}/links`;

  return renderBrandedEmail({
    subject: `Broken external link detected: ${linkName}`,
    preheader: `${linkName} could not be reached from the Carleton Lodge links page.`,
    eyebrow: "Website link report",
    heading: "An external link needs review",
    paragraphs: [
      "The Lodge website could not reach this external resource. This is the only automatic email that will be generated for this link, even if more visitors encounter it.",
    ],
    details: [
      { label: "Link", value: linkName },
      ...(targetUrl ? [{ label: "Address", value: targetUrl }] : []),
      ...(failureReason ? [{ label: "Failure", value: failureReason }] : []),
      ...(detectedAt ? [{ label: "First detected", value: detectedAt }] : []),
    ],
    cta: { label: "Review Masonic links", url: linksUrl },
    siteUrl,
  });
};
