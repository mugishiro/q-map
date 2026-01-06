const STATE_KEY = "qmap_oauth_state";
const VERIFIER_KEY = "qmap_pkce_verifier";

type CognitoConfig = {
  domain: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
};

const base64UrlEncode = (input: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const normalizeDomain = (domain: string) => {
  const region = import.meta.env.VITE_AWS_REGION || "ap-northeast-1";
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain;
  // If the value looks like a short prefix (no dot), append Cognito Hosted UI suffix.
  if (!domain.includes(".")) {
    return `https://${domain}.auth.${region}.amazoncognito.com`;
  }
  return `https://${domain.replace(/^https?:\/\//, "")}`;
};

const getConfig = (): CognitoConfig | null => {
  const domainRaw = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!domainRaw || !clientId) return null;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI || window.location.origin + "/";
  const domain = normalizeDomain(domainRaw);
  return {
    domain: domain.replace(/\/$/, ""),
    clientId,
    redirectUri,
    scope: "openid email profile",
  };
};

const generateCodeVerifier = () => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
};

const generateCodeChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
};

const buildAuthorizeUrl = (config: CognitoConfig, state: string, codeChallenge: string) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope || "openid email profile",
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  return `${config.domain}/oauth2/authorize?${params.toString()}`;
};

const getStoredState = () => localStorage.getItem(STATE_KEY);
const getStoredVerifier = () => localStorage.getItem(VERIFIER_KEY);

const storePkce = (state: string, verifier: string) => {
  localStorage.setItem(STATE_KEY, state);
  localStorage.setItem(VERIFIER_KEY, verifier);
};

const clearPkce = () => {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
};

const startLogin = async () => {
  const config = getConfig();
  if (!config) throw new Error("Cognito client/domain is not configured.");
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();
  storePkce(state, verifier);
  const url = buildAuthorizeUrl(config, state, challenge);
  window.location.href = url;
};

const exchangeCodeForToken = async (code: string, stateFromUrl?: string) => {
  const config = getConfig();
  if (!config) throw new Error("Cognito client/domain is not configured.");
  const storedState = getStoredState();
  if (storedState && stateFromUrl && storedState !== stateFromUrl) {
    throw new Error("OAuth state mismatch. Please try logging in again.");
  }
  const verifier = getStoredVerifier();
  if (!verifier) {
    throw new Error("Missing PKCE verifier. Please restart login.");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
  };
  clearPkce();
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
  };
};

export const auth = {
  isConfigured: () => Boolean(getConfig()),
  getConfig,
  startLogin,
  exchangeCodeForToken,
  clearAuthArtifacts: clearPkce,
};
