import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";

export type DashboardSession = {
  accessToken: string;
  idToken?: string;
  expiresAt: number;
  user: {
    subject: string;
    email?: string;
    name?: string;
    tenant?: string;
    groups: string[];
    roles: string[];
  };
};

export const sessionCookieName = "__Host-aws_dash_session";
export const oidcStateCookieName = "__Host-aws_dash_oidc_state";

function base64url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function secretKey() {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_COOKIE_SECRET must be at least 32 characters");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${base64url(iv)}.${base64url(tag)}.${base64url(ciphertext)}`;
}

export function decryptJson<T>(value: string): T {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid encrypted cookie");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), fromBase64url(ivRaw));
  decipher.setAuthTag(fromBase64url(tagRaw));
  const plaintext = Buffer.concat([decipher.update(fromBase64url(ciphertextRaw)), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function codeChallenge(verifier: string) {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function randomToken() {
  return base64url(randomBytes(32));
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) return {};
  return JSON.parse(fromBase64url(payload).toString("utf8")) as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

export function sessionFromTokenSet(tokenSet: Record<string, unknown>): DashboardSession {
  const accessToken = String(tokenSet.access_token || "");
  const idToken = typeof tokenSet.id_token === "string" ? tokenSet.id_token : undefined;
  const claims = idToken ? decodeJwtPayload(idToken) : decodeJwtPayload(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Number(tokenSet.expires_in || 3600);

  return {
    accessToken,
    idToken,
    expiresAt: now + expiresIn,
    user: {
      subject: String(claims.sub || ""),
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: typeof claims.name === "string" ? claims.name : typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
      tenant: typeof claims.aws_dash_tenant === "string" ? claims.aws_dash_tenant : undefined,
      groups: asStringArray(claims.groups),
      roles: asStringArray(claims.roles),
    },
  };
}

export function getDashboardSession(): DashboardSession | null {
  if (process.env.AUTH_BYPASS_LOGIN === "true") {
    return {
      accessToken: "local-dev",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: {
        subject: "local-dev",
        email: "local-dev@example.com",
        name: "Local Dev",
        tenant: "default",
        groups: ["local-dev"],
        roles: ["admin"],
      },
    };
  }

  const raw = cookies().get(sessionCookieName)?.value;
  if (!raw) return null;
  const session = decryptJson<DashboardSession>(raw);
  if (session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return session;
}
