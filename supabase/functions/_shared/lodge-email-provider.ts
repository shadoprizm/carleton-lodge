export {
  LODGE_EMAIL_DOMAIN,
  LODGE_EMAIL_SETUP,
} from "./lodge-email-settings.ts";
import { LODGE_EMAIL_DOMAIN } from "./lodge-email-settings.ts";

export type ProviderMailboxStatus = {
  address: string;
  quotaMb: number | null;
  usageMb: number | null;
  dailySendLimit: number | null;
  sentToday: number | null;
  suspended: boolean | null;
};

export type CreateMailboxInput = {
  address: string;
  password: string;
  quotaMb: number;
  dailySendLimit: number;
};

export type UpdateMailboxInput = {
  password?: string;
  quotaMb?: number;
  dailySendLimit?: number;
};

export type ProviderForwarderStatus = {
  address: string;
  destinations: string[];
};

export interface LodgeEmailProvider {
  readonly name: "mxroute";
  readonly capabilities: {
    createMailbox: true;
    getMailbox: true;
    changePassword: true;
    updateQuota: true;
    updateDailySendLimit: true;
    deleteMailbox: true;
    ensureForwarder: true;
    suspendMailbox: false;
    revokeSessions: false;
    revokeAppPasswords: false;
  };
  getMailbox(address: string): Promise<ProviderMailboxStatus | null>;
  createMailbox(input: CreateMailboxInput): Promise<ProviderMailboxStatus>;
  updateMailbox(address: string, input: UpdateMailboxInput): Promise<void>;
  deleteMailbox(address: string): Promise<void>;
  ensureForwarder(
    address: string,
    destinations: string[],
  ): Promise<ProviderForwarderStatus>;
}

type MxrouteApiAccount = {
  email?: unknown;
  username?: unknown;
  quota?: unknown;
  usage?: unknown;
  limit?: unknown;
  sent?: unknown;
  suspended?: unknown;
};

type MxrouteApiForwarder = {
  alias?: unknown;
  email?: unknown;
  destinations?: unknown;
};

const numericOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function normalizeLodgeEmailAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*@carpmasons[.]ca$/.test(normalized)) {
    throw new Error("A valid carpmasons.ca mailbox address is required");
  }
  return normalized;
}

export function lodgeEmailLocalPart(address: string) {
  return normalizeLodgeEmailAddress(address).split("@", 1)[0];
}

export function createProviderLockPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const random = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `Aa1!${random}`;
}

function mxrouteConfiguration() {
  const server = Deno.env.get("MXROUTE_API_SERVER");
  const username = Deno.env.get("MXROUTE_API_USERNAME");
  const apiKey = Deno.env.get("MXROUTE_API_KEY");

  if (!server || !username || !apiKey) {
    throw new Error("MXroute mailbox management is not configured");
  }

  return { server, username, apiKey };
}

async function mxrouteError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: unknown };
  } | null;
  return typeof body?.error?.message === "string"
    ? body.error.message
    : `MXroute returned HTTP ${response.status}`;
}

function toProviderStatus(
  address: string,
  account: MxrouteApiAccount,
): ProviderMailboxStatus {
  return {
    address: normalizeLodgeEmailAddress(
      typeof account.email === "string" ? account.email : address,
    ),
    quotaMb: numericOrNull(account.quota),
    usageMb: numericOrNull(account.usage),
    dailySendLimit: numericOrNull(account.limit),
    sentToday: numericOrNull(account.sent),
    suspended: typeof account.suspended === "boolean"
      ? account.suspended
      : null,
  };
}

export type MxrouteProviderOptions = {
  fetch?: typeof fetch;
  configuration?: {
    server: string;
    username: string;
    apiKey: string;
  };
};

export function createMxrouteProvider(
  options: MxrouteProviderOptions = {},
): LodgeEmailProvider {
  const request = async (path: string, init: RequestInit = {}) => {
    const { server, username, apiKey } = options.configuration ??
      mxrouteConfiguration();
    return await (options.fetch ?? fetch)(`https://api.mxroute.com${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-Server": server,
        "X-Username": username,
        ...(init.headers ?? {}),
      },
    });
  };

  const accountPath = (address: string) =>
    `/domains/${encodeURIComponent(LODGE_EMAIL_DOMAIN)}/email-accounts/${
      encodeURIComponent(lodgeEmailLocalPart(address))
    }`;

  return {
    name: "mxroute",
    capabilities: {
      createMailbox: true,
      getMailbox: true,
      changePassword: true,
      updateQuota: true,
      updateDailySendLimit: true,
      deleteMailbox: true,
      ensureForwarder: true,
      suspendMailbox: false,
      revokeSessions: false,
      revokeAppPasswords: false,
    },
    async getMailbox(address) {
      const normalized = normalizeLodgeEmailAddress(address);
      const response = await request(accountPath(normalized), {
        method: "GET",
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(await mxrouteError(response));

      const body = await response.json().catch(() => null) as {
        data?: MxrouteApiAccount;
      } | null;
      if (!body?.data) {
        throw new Error("MXroute returned an invalid mailbox response");
      }
      return toProviderStatus(normalized, body.data);
    },
    async createMailbox(input) {
      const address = normalizeLodgeEmailAddress(input.address);
      const existing = await this.getMailbox(address);
      if (existing) return existing;

      const response = await request(
        `/domains/${encodeURIComponent(LODGE_EMAIL_DOMAIN)}/email-accounts`,
        {
          method: "POST",
          body: JSON.stringify({
            username: lodgeEmailLocalPart(address),
            password: input.password,
            quota: input.quotaMb,
            limit: input.dailySendLimit,
          }),
        },
      );
      if (!response.ok) throw new Error(await mxrouteError(response));

      const created = await this.getMailbox(address);
      if (!created) {
        throw new Error("MXroute did not return the newly created mailbox");
      }
      return created;
    },
    async updateMailbox(address, input) {
      const body: Record<string, unknown> = {};
      if (input.password !== undefined) body.password = input.password;
      if (input.quotaMb !== undefined) body.quota = input.quotaMb;
      if (input.dailySendLimit !== undefined) body.limit = input.dailySendLimit;
      if (Object.keys(body).length === 0) return;

      const response = await request(accountPath(address), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await mxrouteError(response));
    },
    async deleteMailbox(address) {
      const response = await request(accountPath(address), {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(await mxrouteError(response));
      }
    },
    async ensureForwarder(address, destinations) {
      const normalizedAddress = normalizeLodgeEmailAddress(address);
      const alias = lodgeEmailLocalPart(normalizedAddress);
      const normalizedDestinations = [
        ...new Set(destinations.map((value) => value.trim().toLowerCase())),
      ].filter((value) =>
        /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+[.][a-z]{2,}$/i.test(value)
      );
      if (
        normalizedDestinations.length === 0 ||
        normalizedDestinations.length > 10
      ) {
        throw new Error("One to ten valid forwarder destinations are required");
      }

      const listForwarders = async () => {
        const response = await request(
          `/domains/${encodeURIComponent(LODGE_EMAIL_DOMAIN)}/forwarders`,
          { method: "GET" },
        );
        if (!response.ok) throw new Error(await mxrouteError(response));
        const body = await response.json().catch(() => null) as {
          data?: MxrouteApiForwarder[];
        } | null;
        if (!Array.isArray(body?.data)) {
          throw new Error("MXroute returned an invalid forwarder response");
        }
        return body.data;
      };

      const toStatus = (forwarder: MxrouteApiForwarder) => ({
        address: normalizedAddress,
        destinations: Array.isArray(forwarder.destinations)
          ? forwarder.destinations.filter((value): value is string =>
            typeof value === "string"
          ).map((value) => value.trim().toLowerCase())
          : [],
      });
      const findExisting = (forwarders: MxrouteApiForwarder[]) =>
        forwarders.find((forwarder) =>
          String(forwarder.alias ?? "").toLowerCase() === alias ||
          String(forwarder.email ?? "").toLowerCase() === normalizedAddress
        );

      const existing = findExisting(await listForwarders());
      if (existing) {
        const status = toStatus(existing);
        if (
          JSON.stringify([...status.destinations].sort()) !==
            JSON.stringify([...normalizedDestinations].sort())
        ) {
          throw new Error(
            "MXroute forwarder already exists with different destinations",
          );
        }
        return status;
      }

      const response = await request(
        `/domains/${encodeURIComponent(LODGE_EMAIL_DOMAIN)}/forwarders`,
        {
          method: "POST",
          body: JSON.stringify({ alias, destinations: normalizedDestinations }),
        },
      );
      if (!response.ok) throw new Error(await mxrouteError(response));
      const created = findExisting(await listForwarders());
      if (!created) {
        throw new Error("MXroute did not return the newly created forwarder");
      }
      return toStatus(created);
    },
  };
}

export function mailboxProviderStatusJson(status: ProviderMailboxStatus) {
  return {
    address: status.address,
    quota_mb: status.quotaMb,
    usage_mb: status.usageMb,
    daily_send_limit: status.dailySendLimit,
    sent_today: status.sentToday,
    suspended: status.suspended,
    checked_at: new Date().toISOString(),
  };
}
