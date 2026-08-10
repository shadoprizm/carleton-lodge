import { assertEquals, assertExists } from "jsr:@std/assert@1.0.14";
import { createMxrouteProvider } from "./lodge-email-provider.ts";

const configuration = {
  server: "test.mxlogin.example",
  username: "test-user",
  apiKey: "test-key",
};

Deno.test("MXroute provider preserves an existing mailbox during create", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const provider = createMxrouteProvider({
    configuration,
    fetch: (input, init) => {
      const requestInit = init as globalThis.RequestInit | undefined;
      requests.push({
        url: String(input),
        method: requestInit?.method ?? "GET",
      });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              email: "webmaster@carpmasons.ca",
              quota: 500,
              usage: 12,
              limit: 200,
              sent: 1,
              suspended: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    },
  });

  const account = await provider.createMailbox({
    address: "webmaster@carpmasons.ca",
    password: "Ignored123",
    quotaMb: 500,
    dailySendLimit: 200,
  });

  assertEquals(account.address, "webmaster@carpmasons.ca");
  assertEquals(requests.length, 1);
  assertEquals(requests[0].method, "GET");
});

Deno.test("MXroute provider creates a missing mailbox and verifies it", async () => {
  const requests: Array<{ method: string; body: string }> = [];
  let getCount = 0;
  const provider = createMxrouteProvider({
    configuration,
    fetch: (_input, init) => {
      const requestInit = init as globalThis.RequestInit | undefined;
      const method = requestInit?.method ?? "GET";
      requests.push({
        method,
        body: typeof requestInit?.body === "string" ? requestInit.body : "",
      });
      if (method === "GET" && getCount++ === 0) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: "Not found" } }), {
            status: 404,
          }),
        );
      }
      if (method === "POST") {
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              email: "secretary@carpmasons.ca",
              quota: 500,
              usage: 0,
              limit: 200,
              sent: 0,
              suspended: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    },
  });

  const account = await provider.createMailbox({
    address: "secretary@carpmasons.ca",
    password: "Temporary123",
    quotaMb: 500,
    dailySendLimit: 200,
  });

  assertExists(account);
  assertEquals(requests.map((request) => request.method), [
    "GET",
    "POST",
    "GET",
  ]);
  assertEquals(JSON.parse(requests[1].body).username, "secretary");
});

Deno.test("MXroute provider advertises unsupported revocation operations accurately", () => {
  const provider = createMxrouteProvider({ configuration, fetch });
  assertEquals(provider.capabilities.suspendMailbox, false);
  assertEquals(provider.capabilities.revokeSessions, false);
  assertEquals(provider.capabilities.revokeAppPasswords, false);
});

Deno.test("MXroute provider sends password, quota, and send-limit updates only to MXroute", async () => {
  const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
  const provider = createMxrouteProvider({
    configuration,
    fetch: (_input, init) => {
      const requestInit = init as globalThis.RequestInit | undefined;
      requests.push({
        method: requestInit?.method ?? "GET",
        body: typeof requestInit?.body === "string"
          ? JSON.parse(requestInit.body)
          : {},
      });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });

  await provider.updateMailbox("webmaster@carpmasons.ca", {
    password: "MemberChosen123",
    quotaMb: 750,
    dailySendLimit: 125,
  });

  assertEquals(requests, [{
    method: "PATCH",
    body: { password: "MemberChosen123", quota: 750, limit: 125 },
  }]);
});

Deno.test("MXroute provider surfaces provider failure instead of reporting success", async () => {
  const provider = createMxrouteProvider({
    configuration,
    fetch: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: { message: "Provider unavailable" } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
  });

  let message = "";
  try {
    await provider.updateMailbox("webmaster@carpmasons.ca", {
      password: "MemberChosen123",
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(message, "Provider unavailable");
});
