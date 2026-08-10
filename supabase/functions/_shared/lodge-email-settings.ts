export const LODGE_EMAIL_DOMAIN = "carpmasons.ca";

export const LODGE_EMAIL_SETUP = {
  webmailUrl: "https://webmail.mxroute.com/",
  incoming: {
    hostname: "sunfire.mxrouting.net",
    port: 993,
    security: "SSL/TLS",
  },
  outgoing: {
    hostname: "sunfire.mxrouting.net",
    port: 465,
    security: "SSL/TLS",
    authenticationRequired: true,
  },
} as const;
