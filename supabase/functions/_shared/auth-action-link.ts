export const ACCOUNT_SETUP_REDIRECT_URL =
  "https://www.carpmasons.ca/reset-password";

export function validateAccountSetupActionLink(actionLink: string) {
  let actionUrl: URL;
  try {
    actionUrl = new URL(actionLink);
  } catch {
    throw new Error("Supabase Auth returned an invalid account setup URL");
  }

  if (actionUrl.protocol !== "https:") {
    throw new Error("Supabase Auth returned an insecure account setup URL");
  }
  if (actionUrl.pathname !== "/auth/v1/verify") {
    throw new Error("Supabase Auth returned an unexpected account setup path");
  }
  if (actionUrl.searchParams.get("type") !== "recovery") {
    throw new Error("Supabase Auth returned an unexpected account setup type");
  }
  if (
    actionUrl.searchParams.get("redirect_to") !== ACCOUNT_SETUP_REDIRECT_URL
  ) {
    throw new Error(
      "Supabase Auth did not preserve the production account setup redirect",
    );
  }

  return actionLink;
}
