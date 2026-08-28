import type { AccountInfo, Configuration, PublicClientApplication } from "@azure/msal-browser";

interface PublicConfig {
  tenant_id: string;
  tenant_subdomain: string;
  client_id: string;
  authority: string;
  build_sha: string;
  checkout_url: string;
  studio_price: string;
}

let client: PublicClientApplication | undefined;
let publicConfig: PublicConfig | undefined;
const TEST_IDENTITY = import.meta.env.VITE_E2E_AUTH === "1";
let initialized = false;

export async function initializeIdentity(): Promise<void> {
  try {
    initialized = true;
    publicConfig = {
      tenant_id: "35c6fe40-0ec0-46b6-98c6-213ad4de6650",
      tenant_subdomain: "sociobotcustomers",
      client_id: "25c704f4-465a-47af-80ab-2c489466b697",
      authority: "https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/",
      build_sha: import.meta.env.VITE_BUILD_SHA || "dev",
      checkout_url: "https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout",
      studio_price: "$79 USD per agency each month"
    };
    if (TEST_IDENTITY) return;
    const { BrowserCacheLocation, PublicClientApplication } = await import("@azure/msal-browser");
    const configuration: Configuration = {
      auth: {
        clientId: publicConfig.client_id,
        authority: publicConfig.authority,
        redirectUri: `${window.location.origin}/auth/callback`,
        postLogoutRedirectUri: window.location.origin
      },
      cache: { cacheLocation: BrowserCacheLocation.SessionStorage }
    };
    client = new PublicClientApplication(configuration);
    await client.initialize();
    const redirect = await client.handleRedirectPromise();
    if (redirect?.account) client.setActiveAccount(redirect.account);
    else if (!client.getActiveAccount()) client.setActiveAccount(client.getAllAccounts()[0] ?? null);
  } catch {
    client = undefined;
  }
}

export function currentAccount(): AccountInfo | null {
  if (TEST_IDENTITY && initialized) return { name: "Browser Test Owner", username: "owner@example.test" } as AccountInfo;
  return client?.getActiveAccount() ?? client?.getAllAccounts()[0] ?? null;
}

export async function signIn(): Promise<void> {
  if (!client) throw new Error("Sign-in is temporarily unavailable. Reload the page and try again.");
  await client.loginRedirect({ scopes: ["openid", "profile", "email"], redirectStartPage: `${window.location.origin}/rooms` });
}

export async function signOut(): Promise<void> {
  const account = currentAccount();
  if (!client || !account) return;
  await client.logoutRedirect({ account });
}

export async function identityToken(): Promise<string> {
  if (TEST_IDENTITY) return "test-browser-owner";
  const account = currentAccount();
  if (!client || !account) throw new Error("Sign in before opening a real room.");
  const result = await client.acquireTokenSilent({ account, scopes: ["openid", "profile", "email"] });
  if (!result.idToken) throw new Error("Your sign-in did not return an identity token. Sign out, then sign in again.");
  return result.idToken;
}

export function productConfig(): PublicConfig | undefined {
  return publicConfig;
}
